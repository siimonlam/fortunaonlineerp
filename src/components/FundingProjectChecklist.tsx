import { useState, useEffect, useCallback } from 'react';
import { Check, ChevronDown, ChevronRight, Loader2, RefreshCw, AlertCircle, Bot, User, Database, Layers, FolderOpen, FolderPlus, ExternalLink, Link, X, FileText, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { createChecklistFolders, createBudProjectFolders } from '../utils/googleDriveUtils';

const SHARED_DOC_PREFIXES = [
  'Quotation 報價',
  '反圍標',
  '供應商發票',
  '供應商收據',
  '付款紀錄證明',
];

function isSharedDoc(documentName: string): boolean {
  return SHARED_DOC_PREFIXES.some(prefix => documentName.startsWith(prefix));
}

interface ChecklistTemplate {
  id: string;
  category: string;
  document_name: string;
  description: string;
  is_required: boolean;
  order_index: number;
}

interface ProjectChecklistItem {
  id: string;
  project_id: string;
  checklist_id: string;
  is_checked: boolean;
  is_checked_by_ai: boolean;
  ai_checked_at: string | null;
  notes: string;
  checked_by: string | null;
  checked_by_user_name: string | null;
  checked_at: string | null;
  data: string | null;
  data_by_ai: string | null;
  drive_folder_id: string | null;
}

interface ChecklistFile {
  id: string;
  file_id: string | null;
  file_name: string;
  file_url: string;
  is_verified_by_ai: boolean;
  created_at: string;
}

interface SyncResult {
  new_files_synced: number;
  webhooks_sent: number;
  n8n_configured: boolean;
}

interface ProjectDetail {
  main_project: string;
  sub_project: string;
  checklist_category: string;
  item_number: string;
}

interface FundingProjectChecklistProps {
  projectId: string;
  projectDriveFolderId?: string | null;
  projectName?: string;
  projectReference?: string;
}

interface ChecklistEntry {
  template: ChecklistTemplate;
  projectItem: ProjectChecklistItem | null;
}

interface DocumentGroup {
  document_name: string;
  items: ChecklistEntry[];
}

interface CategoryGroup {
  checklist_category: string;
  documents: DocumentGroup[];
}

interface SubProjectGroup {
  sub_project: string;
  categories: CategoryGroup[];
}

interface MainProjectGroup {
  main_project: string;
  sharedDocuments: DocumentGroup[];
  subProjects: SubProjectGroup[];
}

export default function FundingProjectChecklist({ projectId, projectDriveFolderId, projectName, projectReference }: FundingProjectChecklistProps) {
  const [loading, setLoading] = useState(true);
  const [savingItem, setSavingItem] = useState<{ id: string; type: 'user' | 'ai' } | null>(null);
  const [creatingFolders, setCreatingFolders] = useState(false);
  const [folderResult, setFolderResult] = useState<{ url: string; count: number } | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [creatingBudFolders, setCreatingBudFolders] = useState(false);
  const [budFolderResult, setBudFolderResult] = useState<{ count: number } | null>(null);
  const [budFolderError, setBudFolderError] = useState<string | null>(null);
  const [localDriveFolderId, setLocalDriveFolderId] = useState<string | null>(projectDriveFolderId ?? null);
  const [checklistFolderId, setChecklistFolderId] = useState<string | null>(null);
  const [mainProjectGroups, setMainProjectGroups] = useState<MainProjectGroup[]>([]);
  const [hasProjectDetails, setHasProjectDetails] = useState(true);
  const [collapsedMain, setCollapsedMain] = useState<Set<string>>(new Set());
  const [collapsedShared, setCollapsedShared] = useState<Set<string>>(new Set());
  const [collapsedSub, setCollapsedSub] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [collapsedDocuments, setCollapsedDocuments] = useState<Set<string>>(new Set());
  const [expandedData, setExpandedData] = useState<Set<string>>(new Set());
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [syncingItem, setSyncingItem] = useState<string | null>(null);
  const [syncToast, setSyncToast] = useState<{ templateId: string; message: string; type: 'success' | 'error' } | null>(null);
  const [checklistFiles, setChecklistFiles] = useState<Map<string, ChecklistFile[]>>(new Map());
  const [folderInputItem, setFolderInputItem] = useState<string | null>(null);
  const [folderInputValue, setFolderInputValue] = useState<string>('');
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncAllResult, setSyncAllResult] = useState<{ synced: number; sent: number } | null>(null);
  const [syncAllError, setSyncAllError] = useState<string | null>(null);

  const loadCurrentUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle();
    setCurrentUserName(profile?.full_name || profile?.email || user.email || '');
  }, []);

  const loadChecklist = useCallback(async () => {
    setLoading(true);
    try {
      const { data: projectData } = await supabase
        .from('projects')
        .select('checklist_folder_id')
        .eq('id', projectId)
        .maybeSingle();
      if (projectData?.checklist_folder_id) {
        setChecklistFolderId(projectData.checklist_folder_id);
      }

      const [detailsRes, templatesRes, projectItemsRes] = await Promise.all([
        supabase
          .from('funding_project_details')
          .select('main_project, sub_project, checklist_category, item_number')
          .eq('project_id', projectId)
          .not('checklist_category', 'is', null)
          .not('checklist_category', 'eq', '')
          .order('item_number', { ascending: true }),
        supabase
          .from('funding_document_checklist')
          .select('*')
          .order('category')
          .order('order_index'),
        supabase
          .from('project_checklist_items')
          .select('*')
          .eq('project_id', projectId),
      ]);

      if (templatesRes.error) throw templatesRes.error;

      const details: ProjectDetail[] = (detailsRes.data || []).filter(
        d => d.main_project && d.checklist_category
      );
      const templates: ChecklistTemplate[] = templatesRes.data || [];
      const projectItems: ProjectChecklistItem[] = projectItemsRes.data || [];

      if (details.length === 0) {
        setHasProjectDetails(false);
        setMainProjectGroups([]);
        setLoading(false);
        return;
      }

      setHasProjectDetails(true);

      const projectItemMap = new Map<string, ProjectChecklistItem>();
      projectItems.forEach(item => projectItemMap.set(item.checklist_id, item));

      const templatesByCategory = new Map<string, ChecklistTemplate[]>();
      templates.forEach(t => {
        if (!templatesByCategory.has(t.category)) templatesByCategory.set(t.category, []);
        templatesByCategory.get(t.category)!.push(t);
      });

      // Build hierarchy preserving item_number order (same as Project Detail tab)
      // main_project → sub_project → checklist_category
      type CatMap = Map<string, true>;
      type SubMap = Map<string, CatMap>;
      type MainMap = Map<string, SubMap>;

      const mainMap: MainMap = new Map();
      // Track which categories belong to the main project (shared docs) vs sub-projects
      const mainSharedCategories = new Map<string, Set<string>>();

      details.forEach(d => {
        const subKey = d.sub_project || '(No Sub Project)';
        if (!mainMap.has(d.main_project)) {
          mainMap.set(d.main_project, new Map());
          mainSharedCategories.set(d.main_project, new Set());
        }
        const subMap = mainMap.get(d.main_project)!;
        if (!subMap.has(subKey)) subMap.set(subKey, new Map());
        subMap.get(subKey)!.set(d.checklist_category, true);
        mainSharedCategories.get(d.main_project)!.add(d.checklist_category);
      });

      const groups: MainProjectGroup[] = [];

      mainMap.forEach((subMap, main_project) => {
        // Collect ALL checklist entries across all categories for this main project
        // to extract shared documents (Quotation, 反圍標, 供應商發票, etc.)
        const allCategoriesForMain = new Set<string>();
        subMap.forEach((catMap) => {
          catMap.forEach((_, cat) => allCategoriesForMain.add(cat));
        });

        // Build shared documents: collect all templates from all categories for this main project
        // where document_name is one of the 5 shared types
        const sharedDocMap = new Map<string, ChecklistEntry[]>();
        allCategoriesForMain.forEach(cat => {
          const catTemplates = templatesByCategory.get(cat) || [];
          catTemplates.forEach(t => {
            if (isSharedDoc(t.document_name)) {
              if (!sharedDocMap.has(t.document_name)) sharedDocMap.set(t.document_name, []);
              sharedDocMap.get(t.document_name)!.push({
                template: t,
                projectItem: projectItemMap.get(t.id) || null,
              });
            }
          });
        });

        // Deduplicate shared doc entries (same template may appear in multiple categories)
        const seenTemplateIds = new Set<string>();
        const sharedDocuments: DocumentGroup[] = [];
        sharedDocMap.forEach((entries, document_name) => {
          const deduped = entries.filter(e => {
            if (seenTemplateIds.has(e.template.id)) return false;
            seenTemplateIds.add(e.template.id);
            return true;
          });
          if (deduped.length > 0) sharedDocuments.push({ document_name, items: deduped });
        });

        // Sort shared documents in the canonical order
        sharedDocuments.sort((a, b) => {
          const ai = SHARED_DOC_PREFIXES.findIndex(p => a.document_name.startsWith(p));
          const bi = SHARED_DOC_PREFIXES.findIndex(p => b.document_name.startsWith(p));
          if (ai !== bi) return ai - bi;
          return a.document_name.localeCompare(b.document_name, 'zh-Hant');
        });

        // Build sub-project groups (only non-shared docs)
        const subProjectGroups: SubProjectGroup[] = [];

        subMap.forEach((catMap, sub_project) => {
          const categoryGroups: CategoryGroup[] = [];

          catMap.forEach((_, checklist_category) => {
            const catTemplates = templatesByCategory.get(checklist_category) || [];
            if (catTemplates.length === 0) return;

            const docMap = new Map<string, ChecklistEntry[]>();
            catTemplates.forEach(t => {
              if (isSharedDoc(t.document_name)) return; // skip shared docs
              if (!docMap.has(t.document_name)) docMap.set(t.document_name, []);
              docMap.get(t.document_name)!.push({
                template: t,
                projectItem: projectItemMap.get(t.id) || null,
              });
            });

            const documents: DocumentGroup[] = [];
            docMap.forEach((items, document_name) => documents.push({ document_name, items }));

            if (documents.length > 0) {
              categoryGroups.push({ checklist_category, documents });
            }
          });

          if (categoryGroups.length > 0) {
            subProjectGroups.push({ sub_project, categories: categoryGroups });
          }
        });

        groups.push({ main_project, sharedDocuments, subProjects: subProjectGroups });
      });

      // No sorting — preserve insertion order from item_number ordering (same as Project Detail tab)
      setMainProjectGroups(groups);

      // Load files for all project items that exist
      const itemsWithIds = projectItems.filter(i => i.id);
      if (itemsWithIds.length > 0) {
        const { data: allFiles } = await supabase
          .from('project_checklist_files')
          .select('id, file_id, file_name, file_url, is_verified_by_ai, created_at, checklist_item_id')
          .in('checklist_item_id', itemsWithIds.map(i => i.id));
        if (allFiles) {
          const fileMap = new Map<string, ChecklistFile[]>();
          allFiles.forEach((f: ChecklistFile & { checklist_item_id: string }) => {
            if (!fileMap.has(f.checklist_item_id)) fileMap.set(f.checklist_item_id, []);
            fileMap.get(f.checklist_item_id)!.push(f);
          });
          setChecklistFiles(fileMap);
        }
      }
    } catch (err) {
      console.error('Error loading checklist:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadCurrentUser();
    loadChecklist();
  }, [loadCurrentUser, loadChecklist]);

  const handleCreateFolders = async () => {
    const folderId = localDriveFolderId || projectDriveFolderId;
    if (!folderId) return;
    setCreatingFolders(true);
    setFolderError(null);
    setFolderResult(null);
    try {
      const result = await createChecklistFolders(projectId, folderId);
      setFolderResult({ url: result.checklist_drive_url, count: result.folders_created });
      if (result.checklist_folder_id) {
        setChecklistFolderId(result.checklist_folder_id);
        await supabase
          .from('projects')
          .update({ checklist_folder_id: result.checklist_folder_id })
          .eq('id', projectId);
      }
      await loadChecklist();
    } catch (err) {
      setFolderError(err instanceof Error ? err.message : 'Failed to create folders');
    } finally {
      setCreatingFolders(false);
    }
  };

  const handleCreateBudFolders = async () => {
    if (!projectName) return;
    if (!confirm('This will create a BUD folder structure on Google Drive for this project. Continue?')) return;
    setCreatingBudFolders(true);
    setBudFolderError(null);
    setBudFolderResult(null);
    try {
      const result = await createBudProjectFolders(projectId, projectName, projectReference);
      setLocalDriveFolderId(result.root_folder_id);
      setBudFolderResult({ count: result.folders_created });
    } catch (err) {
      setBudFolderError(err instanceof Error ? err.message : 'Failed to create BUD folders');
    } finally {
      setCreatingBudFolders(false);
    }
  };

  const loadFilesForItem = useCallback(async (projectItemId: string) => {
    const { data } = await supabase
      .from('project_checklist_files')
      .select('id, file_id, file_name, file_url, is_verified_by_ai, created_at')
      .eq('checklist_item_id', projectItemId)
      .order('created_at', { ascending: true });
    if (data) {
      setChecklistFiles(prev => {
        const next = new Map(prev);
        next.set(projectItemId, data);
        return next;
      });
    }
  }, []);

  const saveDriveFolderForItem = async (template: ChecklistTemplate, projectItem: ProjectChecklistItem | null, folderId: string) => {
    const trimmed = folderId.trim();
    if (!trimmed) return;
    const result = await upsertItemDirect(template, projectItem, { drive_folder_id: trimmed });
    if (result) updateGroupsWithItem(template.id, result);
    setFolderInputItem(null);
    setFolderInputValue('');
  };

  const handleSyncFromDrive = async (template: ChecklistTemplate, projectItem: ProjectChecklistItem | null) => {
    const folderId = projectItem?.drive_folder_id;
    if (!folderId) {
      setFolderInputItem(template.id);
      setFolderInputValue('');
      return;
    }

    if (!projectItem) return;

    setSyncingItem(template.id);
    setSyncToast(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-checklist-files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          checklist_item_id: projectItem.id,
          drive_folder_id: folderId,
        }),
      });
      const result: SyncResult & { error?: string } = await response.json();
      if (!response.ok || result.error) {
        setSyncToast({ templateId: template.id, message: result.error || 'Sync failed', type: 'error' });
      } else {
        const msg = result.new_files_synced === 0
          ? 'No new files found'
          : `${result.new_files_synced} new file${result.new_files_synced !== 1 ? 's' : ''} found and sent for AI document checking`;
        setSyncToast({ templateId: template.id, message: msg, type: 'success' });
        await loadFilesForItem(projectItem.id);
      }
    } catch (err) {
      setSyncToast({ templateId: template.id, message: err instanceof Error ? err.message : 'Sync failed', type: 'error' });
    } finally {
      setSyncingItem(null);
      setTimeout(() => setSyncToast(prev => prev?.templateId === template.id ? null : prev), 4000);
    }
  };

  const upsertItemDirect = async (
    template: ChecklistTemplate,
    projectItem: ProjectChecklistItem | null,
    updates: Partial<ProjectChecklistItem>
  ): Promise<ProjectChecklistItem | null> => {
    if (projectItem) {
      const { data, error } = await supabase
        .from('project_checklist_items')
        .update(updates)
        .eq('id', projectItem.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('project_checklist_items')
        .insert({
          project_id: projectId,
          checklist_id: template.id,
          category: template.category,
          document_name: template.document_name,
          description: template.description,
          is_checked: false,
          is_checked_by_ai: false,
          ...updates,
        })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  };

  const upsertItem = async (
    template: ChecklistTemplate,
    projectItem: ProjectChecklistItem | null,
    updates: Partial<ProjectChecklistItem>
  ): Promise<ProjectChecklistItem | null> => {
    if (projectItem) {
      const { data, error } = await supabase
        .from('project_checklist_items')
        .update(updates)
        .eq('id', projectItem.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('project_checklist_items')
        .insert({
          project_id: projectId,
          checklist_id: template.id,
          category: template.category,
          document_name: template.document_name,
          description: template.description,
          is_checked: false,
          is_checked_by_ai: false,
          ...updates,
        })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  };

  const updateGroupsWithItem = (templateId: string, updatedItem: ProjectChecklistItem) => {
    setMainProjectGroups(prev =>
      prev.map(mpg => ({
        ...mpg,
        sharedDocuments: mpg.sharedDocuments.map(doc => ({
          ...doc,
          items: doc.items.map(item =>
            item.template.id !== templateId ? item : { ...item, projectItem: updatedItem }
          ),
        })),
        subProjects: mpg.subProjects.map(spg => ({
          ...spg,
          categories: spg.categories.map(cg => ({
            ...cg,
            documents: cg.documents.map(doc => ({
              ...doc,
              items: doc.items.map(item =>
                item.template.id !== templateId ? item : { ...item, projectItem: updatedItem }
              ),
            })),
          })),
        })),
      }))
    );
  };

  const handleSyncAllToN8n = async () => {
    setSyncingAll(true);
    setSyncAllResult(null);
    setSyncAllError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const allItems = mainProjectGroups.flatMap(mpg => getMainProjectItems(mpg));
      const itemsWithFolders = allItems.filter(({ projectItem }) => projectItem?.drive_folder_id);

      if (itemsWithFolders.length === 0) {
        setSyncAllError('No checklist items have a Drive folder linked. Click the Sync button on individual items to link folders first.');
        setSyncingAll(false);
        return;
      }

      let totalSynced = 0;
      let totalSent = 0;

      for (const { projectItem } of itemsWithFolders) {
        if (!projectItem) continue;
        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-checklist-files`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              checklist_item_id: projectItem.id,
              drive_folder_id: projectItem.drive_folder_id,
            }),
          });
          const result = await response.json();
          if (response.ok) {
            totalSynced += result.new_files_synced || 0;
            totalSent += result.webhooks_sent || 0;
            if (result.new_files_synced > 0) {
              await loadFilesForItem(projectItem.id);
            }
          }
        } catch {
          // continue on individual failures
        }
      }

      setSyncAllResult({ synced: totalSynced, sent: totalSent });
    } catch (err) {
      setSyncAllError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncingAll(false);
      setTimeout(() => setSyncAllResult(null), 5000);
    }
  };

  const toggleUserCheck = async (template: ChecklistTemplate, projectItem: ProjectChecklistItem | null) => {
    const newChecked = !(projectItem?.is_checked ?? false);
    setSavingItem({ id: template.id, type: 'user' });
    try {
      const updates: Partial<ProjectChecklistItem> = {
        is_checked: newChecked,
        checked_by: newChecked ? currentUserId || null : null,
        checked_by_user_name: newChecked ? currentUserName || null : null,
        checked_at: newChecked ? new Date().toISOString() : null,
      };
      const result = await upsertItem(template, projectItem, updates);
      if (result) updateGroupsWithItem(template.id, result);
    } catch (err) {
      console.error('Error toggling user check:', err);
    } finally {
      setSavingItem(null);
    }
  };

  const toggle = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  };

  const getProgress = (items: ChecklistEntry[]) => {
    let total = 0; let userChecked = 0; let aiChecked = 0;
    items.forEach(({ projectItem }) => {
      total++;
      if (projectItem?.is_checked) userChecked++;
      if (projectItem?.is_checked_by_ai) aiChecked++;
    });
    return { total, userChecked, aiChecked };
  };

  const getSubProjectItems = (spg: SubProjectGroup): ChecklistEntry[] =>
    spg.categories.flatMap(cg => cg.documents.flatMap(doc => doc.items));

  const getMainProjectItems = (mpg: MainProjectGroup): ChecklistEntry[] => [
    ...mpg.sharedDocuments.flatMap(doc => doc.items),
    ...mpg.subProjects.flatMap(spg => getSubProjectItems(spg)),
  ];

  const getCategoryItems = (cg: CategoryGroup): ChecklistEntry[] =>
    cg.documents.flatMap(doc => doc.items);

  const getTotalProgress = () => {
    const allItems = mainProjectGroups.flatMap(mpg => getMainProjectItems(mpg));
    return getProgress(allItems);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-slate-500 text-sm">Loading checklist...</span>
      </div>
    );
  }

  if (!hasProjectDetails) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 px-6">
        <AlertCircle className="w-10 h-10 text-slate-300 mb-3" />
        <p className="text-sm font-medium text-slate-500">No project details found</p>
        <p className="text-xs text-slate-400 mt-1 text-center">
          Please extract project details first from the Project Detail tab to generate a checklist.
        </p>
      </div>
    );
  }

  const { total, userChecked, aiChecked } = getTotalProgress();
  const pct = total > 0 ? Math.round((userChecked / total) * 100) : 0;
  const aiPct = total > 0 ? Math.round((aiChecked / total) * 100) : 0;

  const renderChecklistItem = (template: ChecklistTemplate, projectItem: ProjectChecklistItem | null) => {
    const isUserChecked = projectItem?.is_checked ?? false;
    const isAiChecked = projectItem?.is_checked_by_ai ?? false;
    const hasData = !!(projectItem?.data || projectItem?.data_by_ai);
    const dataKey = template.id;
    const isDataExpanded = expandedData.has(dataKey);
    const isSavingUser = savingItem?.id === template.id && savingItem.type === 'user';
    const isSavingAi = savingItem?.id === template.id && savingItem.type === 'ai';
    const isSyncing = syncingItem === template.id;
    const hasDriveFolder = !!(projectItem?.drive_folder_id);
    const isShowingFolderInput = folderInputItem === template.id;
    const itemFiles = projectItem ? (checklistFiles.get(projectItem.id) || []) : [];
    const toast = syncToast?.templateId === template.id ? syncToast : null;

    return (
      <div key={template.id} className={`border-t border-slate-50 transition-colors ${isUserChecked ? 'bg-green-50/20' : ''}`}>
        <div className="flex items-start gap-3 px-11 py-2.5">
          <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
            <button
              onClick={() => toggleUserCheck(template, projectItem)}
              disabled={!!savingItem}
              title="Staff check"
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                isUserChecked
                  ? 'bg-blue-500 border-blue-500'
                  : 'border-slate-300 hover:border-blue-400 bg-white'
              }`}
            >
              {isSavingUser ? (
                <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
              ) : isUserChecked ? (
                <User className="w-2.5 h-2.5 text-white" />
              ) : (
                <User className="w-2.5 h-2.5 text-slate-300" />
              )}
            </button>

            <div
              title="AI verified (read-only)"
              className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-default ${
                isAiChecked
                  ? 'bg-amber-400 border-amber-400'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              {isSavingAi ? (
                <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
              ) : isAiChecked ? (
                <Bot className="w-2.5 h-2.5 text-white" />
              ) : (
                <Bot className="w-2.5 h-2.5 text-slate-300" />
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <span className={`text-sm ${isUserChecked ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
              {template.description}
            </span>

            {isUserChecked && projectItem?.checked_by_user_name && (
              <div className="flex items-center gap-1 mt-0.5">
                <User className="w-3 h-3 text-blue-400" />
                <span className="text-xs text-blue-500">{projectItem.checked_by_user_name}</span>
                {projectItem.checked_at && (
                  <span className="text-xs text-slate-400">
                    · {new Date(projectItem.checked_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-1">
            {template.is_required && !isUserChecked && (
              <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                Required
              </span>
            )}
            {hasData && (
              <button
                onClick={() => toggle(expandedData, dataKey, setExpandedData)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded transition-colors"
              >
                <Database className="w-3 h-3" />
                Data
              </button>
            )}
            <button
              onClick={() => handleSyncFromDrive(template, projectItem)}
              disabled={isSyncing}
              title={hasDriveFolder ? 'Sync files from Drive folder' : 'Link a Drive folder to sync files'}
              className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                hasDriveFolder
                  ? 'text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100'
                  : 'text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200'
              }`}
            >
              {isSyncing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              {isSyncing ? 'Syncing...' : 'Sync'}
            </button>
          </div>
        </div>

        {isShowingFolderInput && (
          <div className="mx-11 mb-2">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <Link className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                value={folderInputValue}
                onChange={e => setFolderInputValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveDriveFolderForItem(template, projectItem, folderInputValue);
                  if (e.key === 'Escape') { setFolderInputItem(null); setFolderInputValue(''); }
                }}
                placeholder="Paste Google Drive folder ID..."
                className="flex-1 text-xs bg-transparent outline-none text-slate-700 placeholder-slate-400"
                autoFocus
              />
              <button
                onClick={() => saveDriveFolderForItem(template, projectItem, folderInputValue)}
                disabled={!folderInputValue.trim()}
                className="text-xs text-green-600 hover:text-green-800 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save
              </button>
              <button
                onClick={() => { setFolderInputItem(null); setFolderInputValue(''); }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1 ml-1">
              Find the folder ID in the Google Drive URL: drive.google.com/drive/folders/<strong>FOLDER_ID</strong>
            </p>
          </div>
        )}

        {toast && (
          <div className={`mx-11 mb-2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
            toast.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {toast.type === 'success' ? (
              <Check className="w-3.5 h-3.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            )}
            {toast.message}
          </div>
        )}

        {itemFiles.length > 0 && (
          <div className="mx-11 mb-2 space-y-1">
            {itemFiles.map(file => (
              <div key={file.id} className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
                <FileText className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <a
                  href={file.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-xs text-slate-600 hover:text-blue-600 truncate min-w-0"
                >
                  {file.file_name}
                </a>
                {file.is_verified_by_ai ? (
                  <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded flex-shrink-0">
                    <Bot className="w-2.5 h-2.5" /> AI verified
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 flex-shrink-0">Pending AI</span>
                )}
              </div>
            ))}
          </div>
        )}

        {isDataExpanded && hasData && (
          <div className="mx-11 mb-2 space-y-1.5">
            {projectItem?.data_by_ai && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <Bot className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-amber-700 mb-0.5">AI Data</div>
                  <div className="text-xs text-amber-800 break-words">{projectItem.data_by_ai}</div>
                </div>
              </div>
            )}
            {projectItem?.data && (
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <User className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-blue-700 mb-0.5">Staff Data</div>
                  <div className="text-xs text-blue-800 break-words">{projectItem.data}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderDocumentGroup = (doc: DocumentGroup, docKey: string, indentClass: string) => {
    const docProgress = getProgress(doc.items);
    const docAllDone = docProgress.userChecked === docProgress.total && docProgress.total > 0;
    const docCollapsed = collapsedDocuments.has(docKey);

    return (
      <div key={doc.document_name}>
        <button
          onClick={() => toggle(collapsedDocuments, docKey, setCollapsedDocuments)}
          className={`w-full flex items-center justify-between ${indentClass} py-2 text-left transition-colors ${
            docAllDone ? 'bg-green-50/30 hover:bg-green-50/50' : 'bg-white hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {docCollapsed
              ? <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
              : <ChevronDown className="w-3 h-3 text-slate-300 flex-shrink-0" />
            }
            <span className={`text-sm truncate font-medium ${docAllDone ? 'text-green-600' : 'text-slate-600'}`}>
              {doc.document_name}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            <span className={`text-xs flex items-center gap-1 ${docAllDone ? 'text-green-500' : 'text-slate-300'}`}>
              <User className="w-3 h-3" /> {docProgress.userChecked}/{docProgress.total}
            </span>
            <span className="text-xs text-amber-400 flex items-center gap-1">
              <Bot className="w-3 h-3" /> {docProgress.aiChecked}/{docProgress.total}
            </span>
          </div>
        </button>

        {!docCollapsed && (
          <div className="bg-white">
            {doc.items.map(({ template, projectItem }) => renderChecklistItem(template, projectItem))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Document Checklist</h3>
          <div className="flex items-center gap-4 mt-1">
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded bg-blue-500 flex items-center justify-center">
                <User className="w-2.5 h-2.5 text-white" />
              </div>
              <span className="text-xs text-slate-500">{userChecked}/{total} verified by staff</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded bg-amber-500 flex items-center justify-center">
                <Bot className="w-2.5 h-2.5 text-white" />
              </div>
              <span className="text-xs text-slate-500">{aiChecked}/{total} verified by AI</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">{pct}%</div>
            <div className="text-xs text-slate-400">staff complete</div>
          </div>
          {(localDriveFolderId || projectDriveFolderId) ? (
            <button
              onClick={!checklistFolderId ? handleCreateFolders : undefined}
              disabled={creatingFolders || !!checklistFolderId}
              title={checklistFolderId ? 'Checklist folders already created' : 'Create Checklist folder structure in Google Drive'}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-colors disabled:cursor-not-allowed ${
                checklistFolderId
                  ? 'bg-slate-300 opacity-60'
                  : 'bg-green-600 hover:bg-green-700 disabled:opacity-50'
              }`}
            >
              {creatingFolders ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FolderOpen className="w-3.5 h-3.5" />
              )}
              {creatingFolders ? 'Creating...' : checklistFolderId ? 'Folders Created' : 'Create Checklist Folders'}
            </button>
          ) : (
            <button
              onClick={handleCreateBudFolders}
              disabled={creatingBudFolders || !projectName}
              title="Create BUD folder structure in Google Drive"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creatingBudFolders ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FolderPlus className="w-3.5 h-3.5" />
              )}
              {creatingBudFolders ? 'Creating...' : 'Create BUD Folders'}
            </button>
          )}
          <button
            onClick={handleSyncAllToN8n}
            disabled={syncingAll}
            title="Sync all linked Drive folders and send new files for AI document checking"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncingAll ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            {syncingAll ? 'Checking...' : 'Check document by AI'}
          </button>
          <button
            onClick={loadChecklist}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          <div className="flex-1 bg-slate-200 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
        </div>
        <div className="flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <div className="flex-1 bg-slate-200 rounded-full h-2">
            <div className="bg-amber-400 h-2 rounded-full transition-all duration-500" style={{ width: `${aiPct}%` }} />
          </div>
          <span className="text-xs text-slate-400 w-8 text-right">{aiPct}%</span>
        </div>
      </div>

      {folderResult && (
        <div className="flex items-center justify-between gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-green-700">
            <FolderOpen className="w-4 h-4 text-green-600 flex-shrink-0" />
            <span className="font-medium">{folderResult.count} folders created successfully</span>
          </div>
          <a
            href={folderResult.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-green-700 hover:text-green-900 font-medium underline"
          >
            Open in Drive <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {folderError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{folderError}</p>
        </div>
      )}

      {budFolderResult && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <FolderPlus className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span className="text-sm font-medium text-blue-700">{budFolderResult.count} BUD folders created successfully. You can now create checklist folders.</span>
        </div>
      )}

      {budFolderError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{budFolderError}</p>
        </div>
      )}

      {syncAllResult && (
        <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <Send className="w-4 h-4 text-orange-500 flex-shrink-0" />
          <span className="text-sm text-orange-700 font-medium">
            {syncAllResult.synced === 0
              ? 'No new files found across all folders'
              : `${syncAllResult.synced} new file${syncAllResult.synced !== 1 ? 's' : ''} sent for AI document checking`}
          </span>
        </div>
      )}

      {syncAllError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{syncAllError}</p>
        </div>
      )}

      <div className="flex items-center gap-6 py-2 px-3 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2 border-blue-400 bg-blue-500 flex items-center justify-center flex-shrink-0">
            <User className="w-2.5 h-2.5 text-white" />
          </div>
          <span>Staff verified</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2 border-amber-400 bg-amber-400 flex items-center justify-center flex-shrink-0">
            <Bot className="w-2.5 h-2.5 text-white" />
          </div>
          <span>AI verified (read-only)</span>
        </div>
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-slate-400" />
          <span>Has data</span>
        </div>
      </div>

      <div className="space-y-3">
        {mainProjectGroups.map(mpg => {
          const mpItems = getMainProjectItems(mpg);
          const mpProgress = getProgress(mpItems);
          const mpAllDone = mpProgress.userChecked === mpProgress.total && mpProgress.total > 0;
          const mpCollapsed = collapsedMain.has(mpg.main_project);

          return (
            <div key={mpg.main_project} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              {/* Main Project Header */}
              <button
                onClick={() => toggle(collapsedMain, mpg.main_project, setCollapsedMain)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                  mpAllDone ? 'bg-green-50 hover:bg-green-100' : 'bg-slate-100 hover:bg-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {mpCollapsed
                    ? <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  }
                  <span className={`font-semibold text-sm truncate ${mpAllDone ? 'text-green-700' : 'text-slate-800'}`}>
                    {mpg.main_project}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {mpAllDone && <Check className="w-4 h-4 text-green-600" />}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    mpAllDone ? 'bg-green-100 text-green-700' : 'bg-white text-slate-600'
                  }`}>
                    <User className="w-3 h-3" /> {mpProgress.userChecked}/{mpProgress.total}
                  </span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 flex items-center gap-1">
                    <Bot className="w-3 h-3" /> {mpProgress.aiChecked}/{mpProgress.total}
                  </span>
                </div>
              </button>

              {!mpCollapsed && (
                <div className="divide-y divide-slate-100">
                  {/* Shared document types (Quotation, 反圍標, 供應商發票, etc.) at main project level */}
                  {mpg.sharedDocuments.length > 0 && (() => {
                    const sharedKey = `${mpg.main_project}::shared`;
                    const sharedItems = mpg.sharedDocuments.flatMap(d => d.items);
                    const sharedProgress = getProgress(sharedItems);
                    const sharedAllDone = sharedProgress.userChecked === sharedProgress.total && sharedProgress.total > 0;
                    const sharedCollapsed = collapsedShared.has(sharedKey);

                    return (
                      <div>
                        <button
                          onClick={() => toggle(collapsedShared, sharedKey, setCollapsedShared)}
                          className={`w-full flex items-center justify-between px-5 py-2.5 text-left transition-colors ${
                            sharedAllDone ? 'bg-green-50/70 hover:bg-green-50' : 'bg-slate-50 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FolderOpen className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            {sharedCollapsed
                              ? <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              : <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            }
                            <span className={`text-sm font-semibold truncate ${sharedAllDone ? 'text-green-700' : 'text-slate-700'}`}>
                              供應商文件 (Vendor Documents)
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            {sharedAllDone && <Check className="w-3.5 h-3.5 text-green-600" />}
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              sharedAllDone ? 'bg-green-100 text-green-700' : 'bg-white text-slate-500'
                            }`}>
                              <User className="w-3 h-3" /> {sharedProgress.userChecked}/{sharedProgress.total}
                            </span>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-500 flex items-center gap-1">
                              <Bot className="w-3 h-3" /> {sharedProgress.aiChecked}/{sharedProgress.total}
                            </span>
                          </div>
                        </button>

                        {!sharedCollapsed && (
                          <div className="divide-y divide-slate-50 bg-white">
                            {mpg.sharedDocuments.map(doc => {
                              const docKey = `${sharedKey}::${doc.document_name}`;
                              return renderDocumentGroup(doc, docKey, 'px-9');
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Sub-projects */}
                  {mpg.subProjects.map(spg => {
                    const spKey = `${mpg.main_project}::${spg.sub_project}`;
                    const spItems = getSubProjectItems(spg);
                    const spProgress = getProgress(spItems);
                    const spAllDone = spProgress.userChecked === spProgress.total && spProgress.total > 0;
                    const spCollapsed = collapsedSub.has(spKey);

                    return (
                      <div key={spg.sub_project}>
                        <button
                          onClick={() => toggle(collapsedSub, spKey, setCollapsedSub)}
                          className={`w-full flex items-center justify-between px-5 py-2.5 text-left transition-colors ${
                            spAllDone ? 'bg-green-50/70 hover:bg-green-50' : 'bg-slate-50 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Layers className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            {spCollapsed
                              ? <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              : <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            }
                            <span className={`text-sm font-semibold truncate ${spAllDone ? 'text-green-700' : 'text-slate-700'}`}>
                              {spg.sub_project}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            {spAllDone && <Check className="w-3.5 h-3.5 text-green-600" />}
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              spAllDone ? 'bg-green-100 text-green-700' : 'bg-white text-slate-500'
                            }`}>
                              <User className="w-3 h-3" /> {spProgress.userChecked}/{spProgress.total}
                            </span>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-500 flex items-center gap-1">
                              <Bot className="w-3 h-3" /> {spProgress.aiChecked}/{spProgress.total}
                            </span>
                          </div>
                        </button>

                        {!spCollapsed && (
                          <div className="divide-y divide-slate-100 bg-white">
                            {spg.categories.map(cg => {
                              const catKey = `${spKey}::${cg.checklist_category}`;
                              const catItems = getCategoryItems(cg);
                              const catProgress = getProgress(catItems);
                              const catAllDone = catProgress.userChecked === catProgress.total && catProgress.total > 0;
                              const catCollapsed = collapsedCategories.has(catKey);

                              return (
                                <div key={cg.checklist_category}>
                                  <button
                                    onClick={() => toggle(collapsedCategories, catKey, setCollapsedCategories)}
                                    className={`w-full flex items-center justify-between px-7 py-2 text-left transition-colors ${
                                      catAllDone ? 'bg-green-50/40 hover:bg-green-50/60' : 'bg-slate-50/60 hover:bg-slate-100'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      {catCollapsed
                                        ? <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                        : <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                      }
                                      <span className={`text-xs font-medium uppercase tracking-wide truncate ${catAllDone ? 'text-green-600' : 'text-slate-500'}`}>
                                        {cg.checklist_category}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                      {catAllDone && <Check className="w-3 h-3 text-green-600" />}
                                      <span className={`text-xs flex items-center gap-1 ${catAllDone ? 'text-green-600' : 'text-slate-400'}`}>
                                        <User className="w-3 h-3" /> {catProgress.userChecked}/{catProgress.total}
                                      </span>
                                      <span className="text-xs text-amber-500 flex items-center gap-1">
                                        <Bot className="w-3 h-3" /> {catProgress.aiChecked}/{catProgress.total}
                                      </span>
                                    </div>
                                  </button>

                                  {!catCollapsed && (
                                    <div className="divide-y divide-slate-50">
                                      {cg.documents.map(doc => {
                                        const docKey = `${catKey}::${doc.document_name}`;
                                        return renderDocumentGroup(doc, docKey, 'px-9');
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
