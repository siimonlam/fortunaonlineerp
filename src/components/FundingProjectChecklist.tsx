import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, ChevronDown, ChevronRight, Loader2, RefreshCw, AlertCircle, Bot, User, Layers, FolderOpen, FolderPlus, ExternalLink, FileText, Send, Link, X, Image, Sheet, FileCode, Zap } from 'lucide-react';
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
  document_name: string | null;
  category: string | null;
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

interface ExtractedData {
  vendor_name?: string | null;
  total_amount?: number | null;
  currency?: string | null;
  quotation_date?: string | null;
  sign_date?: string | null;
  [key: string]: unknown;
}

interface ChecklistFile {
  id: string;
  file_id: string | null;
  file_name: string;
  file_url: string;
  is_verified_by_ai: boolean;
  created_at: string;
  checklist_item_id: string;
  extracted_data?: ExtractedData | null;
}

interface FileCheck {
  id: string;
  file_id: string;
  checklist_item_id: string;
  description: string;
  is_required: boolean;
  is_checked: boolean;
  is_checked_by_ai: boolean;
  ai_result: string | null;
  checked_by: string | null;
  checked_at: string | null;
  order_index: number;
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
  projectStartDate?: string | null;
  projectEndDate?: string | null;
}

interface DocumentFolder {
  document_name: string;
  template: ChecklistTemplate;
  projectItem: ProjectChecklistItem | null;
  allProjectItems?: ProjectChecklistItem[];
}

interface CategoryGroup {
  checklist_category: string;
  documents: DocumentFolder[];
}

interface SubProjectGroup {
  sub_project: string;
  categories: CategoryGroup[];
}

interface MainProjectGroup {
  main_project: string;
  sharedDocuments: DocumentFolder[];
  subProjects: SubProjectGroup[];
}

export default function FundingProjectChecklist({ projectId, projectDriveFolderId, projectName, projectReference, projectStartDate, projectEndDate }: FundingProjectChecklistProps) {
  const [loading, setLoading] = useState(true);
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
  const [userToggledDocs, setUserToggledDocs] = useState<Map<string, boolean>>(new Map());
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncAllResult, setSyncAllResult] = useState<{ files: number; debug?: Array<{ folder_id: string; folder_name: string; files_found: number; error?: string }> } | null>(null);
  const [syncAllError, setSyncAllError] = useState<string | null>(null);
  const [savingCheck, setSavingCheck] = useState<string | null>(null);
  const [folderInputItem, setFolderInputItem] = useState<string | null>(null);
  const [folderInputValue, setFolderInputValue] = useState<string>('');
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [confirmDeleteFileId, setConfirmDeleteFileId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [realtimeActive, setRealtimeActive] = useState(false);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Files keyed by checklist_item_id
  const [checklistFiles, setChecklistFiles] = useState<Map<string, ChecklistFile[]>>(new Map());
  // File checks keyed by file row id
  const [fileChecks, setFileChecks] = useState<Map<string, FileCheck[]>>(new Map());

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

  const loadChecklist = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
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

      // For shared docs: map (category, document_name) -> all project items with that combo
      // Also map category -> all items in that category
      const itemsByCategoryAndDocName = new Map<string, ProjectChecklistItem[]>();
      projectItems.forEach(item => {
        if (item.document_name && item.category) {
          const key = `${item.category}|||${item.document_name}`;
          if (!itemsByCategoryAndDocName.has(key)) itemsByCategoryAndDocName.set(key, []);
          itemsByCategoryAndDocName.get(key)!.push(item);
        }
      });

      // Build a deduplication map: for each (category, document_name) keep ONE representative template
      const templatesByCategory = new Map<string, ChecklistTemplate[]>();
      templates.forEach(t => {
        if (!templatesByCategory.has(t.category)) templatesByCategory.set(t.category, []);
        templatesByCategory.get(t.category)!.push(t);
      });

      // For each category, collect unique document_names (first template per doc name)
      const uniqueDocTemplateByCategory = new Map<string, Map<string, ChecklistTemplate>>();
      templatesByCategory.forEach((ts, cat) => {
        const docMap = new Map<string, ChecklistTemplate>();
        ts.forEach(t => {
          if (!docMap.has(t.document_name)) docMap.set(t.document_name, t);
        });
        uniqueDocTemplateByCategory.set(cat, docMap);
      });

      type SubMap = Map<string, Set<string>>;
      type MainMap = Map<string, SubMap>;
      const mainMap: MainMap = new Map();

      details.forEach(d => {
        const subKey = d.sub_project || '(No Sub Project)';
        if (!mainMap.has(d.main_project)) mainMap.set(d.main_project, new Map());
        const subMap = mainMap.get(d.main_project)!;
        if (!subMap.has(subKey)) subMap.set(subKey, new Set());
        subMap.get(subKey)!.add(d.checklist_category);
      });

      const groups: MainProjectGroup[] = [];

      mainMap.forEach((subMap, main_project) => {
        const allCategoriesForMain = new Set<string>();
        subMap.forEach(cats => cats.forEach(c => allCategoriesForMain.add(c)));

        // Shared docs: deduplicated by document_name, scoped to categories of THIS main_project only
        const seenSharedDocNames = new Set<string>();
        const sharedDocuments: DocumentFolder[] = [];
        allCategoriesForMain.forEach(cat => {
          const docMap = uniqueDocTemplateByCategory.get(cat) || new Map();
          docMap.forEach((template, docName) => {
            if (isSharedDoc(docName) && !seenSharedDocNames.has(docName)) {
              seenSharedDocNames.add(docName);
              // Collect items only from categories present in THIS main_project
              const scopedItems: ProjectChecklistItem[] = [];
              const seenItemIds = new Set<string>();
              allCategoriesForMain.forEach(c => {
                const key = `${c}|||${docName}`;
                (itemsByCategoryAndDocName.get(key) || []).forEach(item => {
                  if (!seenItemIds.has(item.id)) { seenItemIds.add(item.id); scopedItems.push(item); }
                });
              });
              sharedDocuments.push({
                document_name: docName,
                template,
                projectItem: projectItemMap.get(template.id) || null,
                allProjectItems: scopedItems,
              });
            }
          });
        });

        sharedDocuments.sort((a, b) => {
          const ai = SHARED_DOC_PREFIXES.findIndex(p => a.document_name.startsWith(p));
          const bi = SHARED_DOC_PREFIXES.findIndex(p => b.document_name.startsWith(p));
          if (ai !== bi) return ai - bi;
          return a.document_name.localeCompare(b.document_name, 'zh-Hant');
        });

        const subProjectGroups: SubProjectGroup[] = [];

        subMap.forEach((cats, sub_project) => {
          const categoryGroups: CategoryGroup[] = [];
          cats.forEach(checklist_category => {
            const docMap = uniqueDocTemplateByCategory.get(checklist_category) || new Map();
            const documents: DocumentFolder[] = [];
            docMap.forEach((template, docName) => {
              if (!isSharedDoc(docName)) {
                documents.push({
                  document_name: docName,
                  template,
                  projectItem: projectItemMap.get(template.id) || null,
                });
              }
            });
            if (documents.length > 0) categoryGroups.push({ checklist_category, documents });
          });
          if (categoryGroups.length > 0) subProjectGroups.push({ sub_project, categories: categoryGroups });
        });

        groups.push({ main_project, sharedDocuments, subProjects: subProjectGroups });
      });

      setMainProjectGroups(groups);

      // Load files for all project items — join via project_checklist_items to avoid large .in() lists
      if (projectItems.length > 0) {
        const { data: allFiles } = await supabase
          .from('project_checklist_files')
          .select('id, file_id, file_name, file_url, is_verified_by_ai, created_at, checklist_item_id, extracted_data, project_checklist_items!inner(project_id)')
          .eq('project_checklist_items.project_id', projectId)
          .order('created_at', { ascending: true });

        if (allFiles && allFiles.length > 0) {
          const fileMap = new Map<string, ChecklistFile[]>();
          allFiles.forEach((f: Record<string, unknown>) => {
            const file = f as unknown as ChecklistFile;
            if (!fileMap.has(file.checklist_item_id)) fileMap.set(file.checklist_item_id, []);
            fileMap.get(file.checklist_item_id)!.push(file);
          });
          setChecklistFiles(fileMap);

          // Load checks for all files
          const fileIds = allFiles.map((f: ChecklistFile) => f.id);
          const { data: allChecks } = await supabase
            .from('project_checklist_file_checks')
            .select('id, file_id, checklist_item_id, description, is_required, is_checked, is_checked_by_ai, ai_result, checked_by, checked_at, order_index')
            .in('file_id', fileIds)
            .order('order_index', { ascending: true });

          if (allChecks && allChecks.length > 0) {
            const checksMap = new Map<string, FileCheck[]>();
            allChecks.forEach((c: FileCheck) => {
              if (!checksMap.has(c.file_id)) checksMap.set(c.file_id, []);
              checksMap.get(c.file_id)!.push(c);
            });
            setFileChecks(checksMap);
          }
        }
      }
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Error loading checklist:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadCurrentUser();
    loadChecklist();
  }, [loadCurrentUser, loadChecklist]);

  useEffect(() => {
    const channel = supabase
      .channel(`checklist-realtime-${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'project_checklist_file_checks',
      }, () => {
        if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = setTimeout(() => loadChecklist(true), 800);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'project_checklist_files',
        filter: `project_checklist_items.project_id=eq.${projectId}`,
      }, () => {
        if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = setTimeout(() => loadChecklist(true), 800);
      })
      .subscribe((status) => {
        setRealtimeActive(status === 'SUBSCRIBED');
      });

    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [projectId, loadChecklist]);

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

  const handleSyncAll = async () => {
    setSyncingAll(true);
    setSyncAllResult(null);
    setSyncAllError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-checklist-files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ project_id: projectId }),
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        setSyncAllError(result.error || 'Sync failed');
      } else {
        setSyncAllResult({ files: result.files_inserted || 0, debug: result.debug });
        await loadChecklist(true);
        if ((result.files_inserted || 0) > 0) setTimeout(() => setSyncAllResult(null), 5000);
      }
    } catch (err) {
      setSyncAllError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncingAll(false);
    }
  };

  const saveDriveFolderForItem = async (doc: DocumentFolder, folderId: string) => {
    const trimmed = folderId.trim();
    if (!trimmed) return;
    const { template, projectItem } = doc;
    if (projectItem) {
      const { data } = await supabase
        .from('project_checklist_items')
        .update({ drive_folder_id: trimmed })
        .eq('id', projectItem.id)
        .select()
        .maybeSingle();
      if (data) updateDocFolder(template.id, data);
    } else {
      const { data } = await supabase
        .from('project_checklist_items')
        .insert({
          project_id: projectId,
          checklist_id: template.id,
          category: template.category,
          document_name: template.document_name,
          description: template.description,
          is_checked: false,
          is_checked_by_ai: false,
          drive_folder_id: trimmed,
        })
        .select()
        .maybeSingle();
      if (data) updateDocFolder(template.id, data);
    }
    setFolderInputItem(null);
    setFolderInputValue('');
  };

  const updateDocFolder = (templateId: string, updatedItem: ProjectChecklistItem) => {
    setMainProjectGroups(prev =>
      prev.map(mpg => ({
        ...mpg,
        sharedDocuments: mpg.sharedDocuments.map(d =>
          d.template.id === templateId ? { ...d, projectItem: updatedItem } : d
        ),
        subProjects: mpg.subProjects.map(spg => ({
          ...spg,
          categories: spg.categories.map(cg => ({
            ...cg,
            documents: cg.documents.map(d =>
              d.template.id === templateId ? { ...d, projectItem: updatedItem } : d
            ),
          })),
        })),
      }))
    );
  };

  const toggleFileCheck = async (check: FileCheck) => {
    const newChecked = !check.is_checked;
    setSavingCheck(check.id);
    try {
      const { data } = await supabase
        .from('project_checklist_file_checks')
        .update({
          is_checked: newChecked,
          checked_by: newChecked ? currentUserId || null : null,
          checked_at: newChecked ? new Date().toISOString() : null,
        })
        .eq('id', check.id)
        .select()
        .maybeSingle();
      if (data) {
        setFileChecks(prev => {
          const next = new Map(prev);
          const existing = next.get(check.file_id) || [];
          next.set(check.file_id, existing.map(c => c.id === check.id ? { ...c, ...data } : c));
          return next;
        });
      }
    } catch (err) {
      console.error('Error toggling check:', err);
    } finally {
      setSavingCheck(null);
    }
  };

  const toggle = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  };

  // Returns whether a single document folder is fully completed by staff / AI
  const isDocComplete = (doc: DocumentFolder): { byStaff: boolean; byAi: boolean; hasChecks: boolean } => {
    const itemsToCheck = doc.allProjectItems && doc.allProjectItems.length > 0
      ? doc.allProjectItems
      : doc.projectItem ? [doc.projectItem] : [];
    if (itemsToCheck.length === 0) return { byStaff: false, byAi: false, hasChecks: false };

    const seenFileIds = new Set<string>();
    let totalChecks = 0; let staffChecked = 0; let aiChecked = 0;
    itemsToCheck.forEach(item => {
      (checklistFiles.get(item.id) || []).forEach(f => {
        if (seenFileIds.has(f.id)) return;
        seenFileIds.add(f.id);
        (fileChecks.get(f.id) || []).forEach(c => {
          totalChecks++;
          if (c.is_checked) staffChecked++;
          if (c.is_checked_by_ai) aiChecked++;
        });
      });
    });
    if (totalChecks === 0) return { byStaff: false, byAi: false, hasChecks: false };
    const byStaff = staffChecked === totalChecks;
    const byAi = aiChecked === totalChecks;
    return { byStaff, byAi, hasChecks: true };
  };

  // Progress counts documents (not individual check items)
  // total = number of documents, userChecked = docs where ALL checks are staff-done, aiChecked = docs where ALL checks are AI-done
  const getDocFolderProgress = (doc: DocumentFolder) => {
    const itemsToCheck = doc.allProjectItems && doc.allProjectItems.length > 0
      ? doc.allProjectItems
      : doc.projectItem ? [doc.projectItem] : [];
    if (itemsToCheck.length === 0) return { total: 1, userChecked: 0, aiChecked: 0, fileCount: 0 };
    let fileCount = 0;
    const seenFileIds = new Set<string>();
    let totalChecks = 0; let staffChecked = 0; let aiChecked = 0;
    itemsToCheck.forEach(item => {
      (checklistFiles.get(item.id) || []).forEach(f => {
        if (seenFileIds.has(f.id)) return;
        seenFileIds.add(f.id);
        fileCount++;
        (fileChecks.get(f.id) || []).forEach(c => {
          totalChecks++;
          if (c.is_checked) staffChecked++;
          if (c.is_checked_by_ai) aiChecked++;
        });
      });
    });
    const staffDone = totalChecks > 0 && staffChecked === totalChecks;
    const aiDone = totalChecks > 0 && aiChecked === totalChecks;
    const docComplete = (staffDone || aiDone) ? 1 : 0;
    return { total: 1, userChecked: docComplete, aiChecked: aiDone ? 1 : 0, fileCount };
  };

  const getGroupProgress = (docs: DocumentFolder[]) => {
    let total = 0; let userChecked = 0; let aiChecked = 0; let fileCount = 0;
    docs.forEach(d => {
      const p = getDocFolderProgress(d);
      total += p.total; userChecked += p.userChecked; aiChecked += p.aiChecked; fileCount += p.fileCount;
    });
    return { total, userChecked, aiChecked, fileCount };
  };

  const getTotalProgress = () => {
    const allDocs = mainProjectGroups.flatMap(mpg => [
      ...mpg.sharedDocuments,
      ...mpg.subProjects.flatMap(spg => spg.categories.flatMap(cg => cg.documents)),
    ]);
    return getGroupProgress(allDocs);
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

  const deleteFile = async (fileId: string) => {
    setDeletingFileId(fileId);
    try {
      await supabase.from('project_checklist_files').delete().eq('id', fileId);
      setChecklistFiles(prev => {
        const updated = new Map(prev);
        updated.forEach((files, itemId) => {
          updated.set(itemId, files.filter(f => f.id !== fileId));
        });
        return updated;
      });
      setFileChecks(prev => { const m = new Map(prev); m.delete(fileId); return m; });
    } finally {
      setDeletingFileId(null);
      setConfirmDeleteFileId(null);
    }
  };

  const getFileTypeBadge = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return { label: 'PDF', color: 'bg-red-100 text-red-600', icon: <FileText className="w-3 h-3" /> };
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) return { label: ext.toUpperCase(), color: 'bg-emerald-100 text-emerald-600', icon: <Image className="w-3 h-3" /> };
    if (['xlsx', 'xls', 'csv'].includes(ext)) return { label: ext.toUpperCase(), color: 'bg-green-100 text-green-600', icon: <Sheet className="w-3 h-3" /> };
    if (['docx', 'doc'].includes(ext)) return { label: ext.toUpperCase(), color: 'bg-blue-100 text-blue-600', icon: <FileText className="w-3 h-3" /> };
    if (['gdoc', 'gsheet'].includes(ext)) return { label: ext === 'gdoc' ? 'DOC' : 'SHEET', color: 'bg-blue-100 text-blue-600', icon: <FileCode className="w-3 h-3" /> };
    return { label: ext.toUpperCase() || 'FILE', color: 'bg-slate-100 text-slate-500', icon: <FileText className="w-3 h-3" /> };
  };

  const renderFileChecks = (file: ChecklistFile) => {
    const checks = fileChecks.get(file.id) || [];
    const fileKey = `file::${file.id}`;
    const isCollapsed = collapsedFiles.has(fileKey);
    const checkedCount = checks.filter(c => c.is_checked).length;
    const aiCount = checks.filter(c => c.is_checked_by_ai).length;
    const allDone = checks.length > 0 && checkedCount === checks.length;
    const typeBadge = getFileTypeBadge(file.file_name);

    const extracted = file.extracted_data;

    return (
      <div key={file.id} className="border-t border-slate-100">
        <button
          onClick={() => toggle(collapsedFiles, fileKey, setCollapsedFiles)}
          className={`w-full flex items-start gap-2 px-4 py-2 text-left transition-colors ${
            allDone ? 'bg-green-50/40 hover:bg-green-50/60' : 'bg-slate-50/80 hover:bg-slate-100'
          }`}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isCollapsed
              ? <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0 mt-0.5" />
              : <ChevronDown className="w-3 h-3 text-slate-300 flex-shrink-0 mt-0.5" />
            }
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${typeBadge.color}`}>
              {typeBadge.icon}
              {typeBadge.label}
            </span>
            <div className="flex flex-col min-w-0 flex-1">
              <a
                href={file.file_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-xs text-slate-600 hover:text-blue-600 truncate text-left font-medium"
              >
                {file.file_name}
              </a>
              {extracted && (
                <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5">
                  {extracted.vendor_name && (
                    <div className="flex items-baseline gap-1 col-span-2">
                      <span className="text-xs text-slate-400 flex-shrink-0">Vendor</span>
                      <span className="text-xs text-slate-700 font-medium truncate">{String(extracted.vendor_name)}</span>
                    </div>
                  )}
                  {extracted.quotation_date && (
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs text-slate-400 flex-shrink-0">Quotation Date</span>
                      <span className="text-xs text-slate-700 font-medium">{String(extracted.quotation_date)}</span>
                    </div>
                  )}
                  {extracted.sign_date && (
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs text-slate-400 flex-shrink-0">Signed Date</span>
                      <span className="text-xs text-slate-700 font-medium">{String(extracted.sign_date)}</span>
                    </div>
                  )}
                  {extracted.total_amount != null && (
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs text-slate-400 flex-shrink-0">Amount</span>
                      <span className="text-xs text-slate-700 font-medium">
                        {extracted.currency ? `${extracted.currency} ` : ''}
                        {Number(extracted.total_amount).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2 mt-0.5">
            {file.is_verified_by_ai && (
              <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                <Bot className="w-2.5 h-2.5" /> AI verified
              </span>
            )}
            {checks.length > 0 && (
              <>
                <span className={`text-xs flex items-center gap-1 ${allDone ? 'text-green-600' : 'text-slate-400'}`}>
                  <User className="w-3 h-3" /> {checkedCount}/{checks.length}
                </span>
                <span className="text-xs text-amber-500 flex items-center gap-1">
                  <Bot className="w-3 h-3" /> {aiCount}/{checks.length}
                </span>
              </>
            )}
            {checks.length === 0 && (
              <span className="text-xs text-slate-300">No checks</span>
            )}
            <button
              onClick={e => { e.stopPropagation(); setConfirmDeleteFileId(file.id); }}
              title="Delete file"
              className="ml-1 p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </button>

        {confirmDeleteFileId === file.id && (
          <div className="flex items-center gap-3 px-10 py-2 bg-red-50 border-t border-red-100">
            <span className="text-xs text-red-700 flex-1">Delete <strong>{file.file_name}</strong>? This cannot be undone.</span>
            <button
              onClick={() => deleteFile(file.id)}
              disabled={deletingFileId === file.id}
              className="text-xs font-medium text-white bg-red-500 hover:bg-red-600 px-2.5 py-1 rounded transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              {deletingFileId === file.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Delete
            </button>
            <button
              onClick={() => setConfirmDeleteFileId(null)}
              className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {!isCollapsed && checks.length > 0 && (
          <div className="divide-y divide-slate-50">
            {checks.map(check => {
              const isSaving = savingCheck === check.id;
              return (
                <div
                  key={check.id}
                  className={`flex items-start gap-3 px-10 py-2 transition-colors ${check.is_checked ? 'bg-green-50/10' : 'bg-white'}`}
                >
                  <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                    <button
                      onClick={() => toggleFileCheck(check)}
                      disabled={!!savingCheck}
                      title="Staff check"
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        check.is_checked
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-slate-300 hover:border-blue-400 bg-white'
                      }`}
                    >
                      {isSaving ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin text-slate-400" />
                      ) : check.is_checked ? (
                        <User className="w-2 h-2 text-white" />
                      ) : (
                        <User className="w-2 h-2 text-slate-300" />
                      )}
                    </button>
                    <div
                      title="AI verified (read-only)"
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-default ${
                        check.is_checked_by_ai
                          ? 'bg-amber-400 border-amber-400'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      {check.is_checked_by_ai ? (
                        <Bot className="w-2 h-2 text-white" />
                      ) : (
                        <Bot className="w-2 h-2 text-slate-300" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs ${check.is_checked ? 'text-slate-400 line-through' : 'text-slate-600'}`}>
                      {check.description}
                    </span>
                    {check.ai_result && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Bot className="w-2.5 h-2.5 text-amber-400" />
                        <span className="text-xs text-amber-600">{check.ai_result}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {check.is_required && !check.is_checked && (
                      <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                        Required
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isCollapsed && checks.length === 0 && (
          <div className="px-10 py-2 text-xs text-slate-400 italic bg-white">
            No check items — sync from Drive to populate checks
          </div>
        )}
      </div>
    );
  };

  const renderDocumentFolder = (doc: DocumentFolder, docKey: string, indentClass: string) => {
    const projectItem = doc.projectItem;
    const itemsToShow = doc.allProjectItems && doc.allProjectItems.length > 0
      ? doc.allProjectItems
      : projectItem ? [projectItem] : [];
    // Deduplicate files by file_id across all items
    const seenIds = new Set<string>();
    const itemFiles: ChecklistFile[] = [];
    itemsToShow.forEach(item => {
      (checklistFiles.get(item.id) || []).forEach(f => {
        if (!seenIds.has(f.id)) { seenIds.add(f.id); itemFiles.push(f); }
      });
    });
    const { total: dTotal, userChecked: dUser, aiChecked: dAi } = getDocFolderProgress(doc);
    const allDone = dTotal > 0 && dUser === dTotal;
    const hasFiles = itemFiles.length > 0;
    // Default: collapsed when no files, expanded when files exist. User toggle overrides default.
    const userOverride = userToggledDocs.get(docKey);
    const effectiveCollapsed = userOverride !== undefined ? userOverride : !hasFiles;
    const hasDriveFolder = itemsToShow.some(i => !!i.drive_folder_id);
    const isShowingFolderInput = folderInputItem === docKey;

    return (
      <div key={docKey}>
        <div className={`flex items-center justify-between ${indentClass} py-2 transition-colors ${
          allDone ? 'bg-green-50/30 hover:bg-green-50/50' : 'bg-white hover:bg-slate-50'
        }`}>
          <button
            onClick={() => setUserToggledDocs(prev => { const m = new Map(prev); m.set(docKey, !effectiveCollapsed); return m; })}
            className="flex items-center gap-2 min-w-0 flex-1 text-left"
          >
            {effectiveCollapsed
              ? <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
              : <ChevronDown className="w-3 h-3 text-slate-300 flex-shrink-0" />
            }
            <span className={`text-sm truncate font-medium ${allDone ? 'text-green-600' : hasFiles ? 'text-blue-600' : 'text-slate-500'}`}>
              {doc.document_name}
            </span>
            {itemFiles.length > 0 && (
              <span className="text-xs text-slate-400 flex-shrink-0 ml-1">
                ({itemFiles.length} file{itemFiles.length !== 1 ? 's' : ''})
              </span>
            )}
            {doc.document_name.startsWith('Quotation') && (projectStartDate || projectEndDate) && (
              <span className="flex items-center gap-1 flex-shrink-0 ml-2 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700 font-normal">
                {projectStartDate && <span>Start: {new Date(projectStartDate).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })}</span>}
                {projectStartDate && projectEndDate && <span className="text-blue-300">–</span>}
                {projectEndDate && <span>End: {new Date(projectEndDate).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })}</span>}
              </span>
            )}
          </button>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {dTotal > 0 && (
              <>
                <span className={`text-xs flex items-center gap-1 ${allDone ? 'text-green-500' : 'text-slate-300'}`}>
                  <User className="w-3 h-3" /> {dUser}/{dTotal}
                </span>
                <span className="text-xs text-amber-400 flex items-center gap-1">
                  <Bot className="w-3 h-3" /> {dAi}/{dTotal}
                </span>
              </>
            )}
            <button
              onClick={() => {
                if (hasDriveFolder) return;
                setFolderInputItem(docKey);
                setFolderInputValue('');
              }}
              title={hasDriveFolder ? `Drive folder linked` : 'Link a Drive folder'}
              className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded transition-colors ${
                hasDriveFolder
                  ? 'text-green-600 bg-green-50 cursor-default'
                  : 'text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200'
              }`}
            >
              <Link className="w-3 h-3" />
              {hasDriveFolder ? 'Linked' : 'Link'}
            </button>
          </div>
        </div>

        {isShowingFolderInput && (
          <div className={`${indentClass} pr-4 pb-2`}>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <Link className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                value={folderInputValue}
                onChange={e => setFolderInputValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveDriveFolderForItem(doc, folderInputValue);
                  if (e.key === 'Escape') { setFolderInputItem(null); setFolderInputValue(''); }
                }}
                placeholder="Paste Google Drive folder ID..."
                className="flex-1 text-xs bg-transparent outline-none text-slate-700 placeholder-slate-400"
                autoFocus
              />
              <button
                onClick={() => saveDriveFolderForItem(doc, folderInputValue)}
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
            <p className="text-xs text-slate-400 mt-1">
              Find the folder ID in the Google Drive URL: drive.google.com/drive/folders/<strong>FOLDER_ID</strong>
            </p>
          </div>
        )}

        {!effectiveCollapsed && (
          <div className="bg-white border-t border-slate-100">
            {itemFiles.length === 0 ? (
              <div className="px-10 py-2.5 text-xs text-slate-400 italic">
                No files synced yet
                {!hasDriveFolder && (
                  <span className="ml-1">— link a Drive folder above, then click "Check by AI"</span>
                )}
                {hasDriveFolder && (
                  <span className="ml-1">— click "Check by AI" to import files</span>
                )}
              </div>
            ) : itemFiles.length === 1 ? (
              renderFileChecks(itemFiles[0])
            ) : (
              <div className="grid gap-px bg-slate-100" style={{ gridTemplateColumns: `repeat(${itemFiles.length}, minmax(0, 1fr))` }}>
                {itemFiles.map(file => (
                  <div key={file.id} className="bg-white">
                    {renderFileChecks(file)}
                  </div>
                ))}
              </div>
            )}
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
              <span className="text-xs text-slate-500">{userChecked}/{total} docs completed (staff or AI)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded bg-amber-500 flex items-center justify-center">
                <Bot className="w-2.5 h-2.5 text-white" />
              </div>
              <span className="text-xs text-slate-500">{aiChecked}/{total} docs completed by AI</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">{pct}%</div>
            <div className="text-xs text-slate-400">docs complete</div>
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
            onClick={handleSyncAll}
            disabled={syncingAll}
            title="Scan Drive folders for new files and send to AI for document checking"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncingAll ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Bot className="w-3.5 h-3.5" />
            )}
            {syncingAll ? 'Checking...' : 'Check by AI'}
          </button>
          <div className="flex items-center gap-2">
            {realtimeActive && (
              <div className="flex items-center gap-1 px-2 py-1 bg-green-50 border border-green-200 rounded-lg" title="Live updates active — changes sync automatically">
                <Zap className="w-3 h-3 text-green-500" />
                <span className="text-xs text-green-600 font-medium">Live</span>
              </div>
            )}
            <div className="relative group">
              <button
                onClick={() => loadChecklist(true)}
                disabled={refreshing}
                title="Refresh checklist data"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 text-xs font-medium border border-slate-200"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              <div className="absolute bottom-full right-0 mb-2 w-56 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                <p className="font-medium mb-1">No full page reload needed</p>
                <p className="text-slate-300">Data auto-updates in real-time. Use this button to manually pull the latest data.</p>
                {lastRefreshed && (
                  <p className="text-slate-400 mt-1 border-t border-slate-700 pt-1">
                    Last updated: {lastRefreshed.toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {total > 0 && (
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
      )}

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
        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg space-y-2">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-orange-500 flex-shrink-0" />
            <span className="text-sm text-orange-700 font-medium">
              {syncAllResult.files === 0
                ? 'No new files found'
                : `${syncAllResult.files} new file${syncAllResult.files !== 1 ? 's' : ''} imported and sent to AI for checking`}
            </span>
            {syncAllResult.files === 0 && (
              <button onClick={() => setSyncAllResult(null)} className="ml-auto text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {syncAllResult.files === 0 && syncAllResult.debug && syncAllResult.debug.length > 0 && (
            <div className="text-xs text-slate-600 space-y-1 border-t border-orange-200 pt-2">
              <p className="font-medium text-slate-500">Folders scanned ({syncAllResult.debug.length}):</p>
              {syncAllResult.debug.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${d.error ? 'bg-red-400' : d.files_found > 0 ? 'bg-green-400' : 'bg-slate-300'}`} />
                  <span className="truncate text-slate-500">{d.folder_name}</span>
                  <span className={`flex-shrink-0 font-medium ${d.error ? 'text-red-500' : 'text-slate-400'}`}>
                    {d.error ? `error: ${d.error.slice(0, 60)}` : `${d.files_found} file${d.files_found !== 1 ? 's' : ''}`}
                  </span>
                </div>
              ))}
            </div>
          )}
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
      </div>

      <div className="space-y-3">
        {mainProjectGroups.map(mpg => {
          const allDocs = [
            ...mpg.sharedDocuments,
            ...mpg.subProjects.flatMap(spg => spg.categories.flatMap(cg => cg.documents)),
          ];
          const mpProgress = getGroupProgress(allDocs);
          const mpAllDone = mpProgress.total > 0 && mpProgress.userChecked === mpProgress.total;
          const mpCollapsed = collapsedMain.has(mpg.main_project);

          return (
            <div key={mpg.main_project} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
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
                  {mpProgress.total > 0 && (
                    <>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        mpAllDone ? 'bg-green-100 text-green-700' : 'bg-white text-slate-600'
                      }`}>
                        <User className="w-3 h-3" /> {mpProgress.userChecked}/{mpProgress.total}
                      </span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 flex items-center gap-1">
                        <Bot className="w-3 h-3" /> {mpProgress.aiChecked}/{mpProgress.total}
                      </span>
                    </>
                  )}
                </div>
              </button>

              {!mpCollapsed && (
                <div className="divide-y divide-slate-100">
                  {mpg.sharedDocuments.length > 0 && (() => {
                    const sharedKey = `${mpg.main_project}::shared`;
                    const sharedProgress = getGroupProgress(mpg.sharedDocuments);
                    const sharedAllDone = sharedProgress.total > 0 && sharedProgress.userChecked === sharedProgress.total;
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
                            {sharedProgress.total > 0 && (
                              <>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                  sharedAllDone ? 'bg-green-100 text-green-700' : 'bg-white text-slate-500'
                                }`}>
                                  <User className="w-3 h-3" /> {sharedProgress.userChecked}/{sharedProgress.total}
                                </span>
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-500 flex items-center gap-1">
                                  <Bot className="w-3 h-3" /> {sharedProgress.aiChecked}/{sharedProgress.total}
                                </span>
                              </>
                            )}
                          </div>
                        </button>

                        {!sharedCollapsed && (
                          <div className="divide-y divide-slate-50 bg-white">
                            {mpg.sharedDocuments.map(doc => {
                              const docKey = `${sharedKey}::${doc.document_name}`;
                              return renderDocumentFolder(doc, docKey, 'px-9');
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {mpg.subProjects.map(spg => {
                    const spKey = `${mpg.main_project}::${spg.sub_project}`;
                    const spDocs = spg.categories.flatMap(cg => cg.documents);
                    const spProgress = getGroupProgress(spDocs);
                    const spAllDone = spProgress.total > 0 && spProgress.userChecked === spProgress.total;
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
                            {spProgress.total > 0 && (
                              <>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                  spAllDone ? 'bg-green-100 text-green-700' : 'bg-white text-slate-500'
                                }`}>
                                  <User className="w-3 h-3" /> {spProgress.userChecked}/{spProgress.total}
                                </span>
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-500 flex items-center gap-1">
                                  <Bot className="w-3 h-3" /> {spProgress.aiChecked}/{spProgress.total}
                                </span>
                              </>
                            )}
                          </div>
                        </button>

                        {!spCollapsed && (
                          <div className="divide-y divide-slate-100 bg-white">
                            {spg.categories.map(cg => {
                              const catKey = `${spKey}::${cg.checklist_category}`;
                              const catProgress = getGroupProgress(cg.documents);
                              const catAllDone = catProgress.total > 0 && catProgress.userChecked === catProgress.total;
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
                                      {catProgress.total > 0 && (
                                        <>
                                          <span className={`text-xs flex items-center gap-1 ${catAllDone ? 'text-green-600' : 'text-slate-400'}`}>
                                            <User className="w-3 h-3" /> {catProgress.userChecked}/{catProgress.total}
                                          </span>
                                          <span className="text-xs text-amber-500 flex items-center gap-1">
                                            <Bot className="w-3 h-3" /> {catProgress.aiChecked}/{catProgress.total}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </button>

                                  {!catCollapsed && (
                                    <div className="divide-y divide-slate-50">
                                      {cg.documents.map(doc => {
                                        const docKey = `${catKey}::${doc.document_name}`;
                                        return renderDocumentFolder(doc, docKey, 'px-9');
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
