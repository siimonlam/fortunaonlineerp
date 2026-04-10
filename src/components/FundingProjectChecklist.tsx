import { useState, useEffect, useCallback } from 'react';
import { Check, ChevronDown, ChevronRight, Loader2, RefreshCw, AlertCircle, Bot, User, Database } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
}

interface ProjectDetail {
  main_project: string;
  checklist_category: string;
}

interface FundingProjectChecklistProps {
  projectId: string;
}

interface DocumentGroup {
  document_name: string;
  items: {
    template: ChecklistTemplate;
    projectItem: ProjectChecklistItem | null;
  }[];
}

interface CategoryGroup {
  checklist_category: string;
  documents: DocumentGroup[];
}

interface MainProjectGroup {
  main_project: string;
  categories: CategoryGroup[];
}

export default function FundingProjectChecklist({ projectId }: FundingProjectChecklistProps) {
  const [loading, setLoading] = useState(true);
  const [savingItem, setSavingItem] = useState<{ id: string; type: 'user' | 'ai' } | null>(null);
  const [mainProjectGroups, setMainProjectGroups] = useState<MainProjectGroup[]>([]);
  const [hasProjectDetails, setHasProjectDetails] = useState(true);
  const [collapsedMain, setCollapsedMain] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [collapsedDocuments, setCollapsedDocuments] = useState<Set<string>>(new Set());
  const [expandedData, setExpandedData] = useState<Set<string>>(new Set());
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');

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
      const [detailsRes, templatesRes, projectItemsRes] = await Promise.all([
        supabase
          .from('funding_project_details')
          .select('main_project, checklist_category')
          .eq('project_id', projectId)
          .not('checklist_category', 'is', null)
          .not('checklist_category', 'eq', ''),
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

      const details: ProjectDetail[] = detailsRes.data || [];
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
      projectItems.forEach(item => {
        projectItemMap.set(item.checklist_id, item);
      });

      const templatesByCategory = new Map<string, ChecklistTemplate[]>();
      templates.forEach(t => {
        if (!templatesByCategory.has(t.category)) {
          templatesByCategory.set(t.category, []);
        }
        templatesByCategory.get(t.category)!.push(t);
      });

      const mainProjectMap = new Map<string, Map<string, ProjectDetail>>();
      details.forEach(d => {
        if (!d.main_project || !d.checklist_category) return;
        if (!mainProjectMap.has(d.main_project)) {
          mainProjectMap.set(d.main_project, new Map());
        }
        mainProjectMap.get(d.main_project)!.set(d.checklist_category, d);
      });

      const groups: MainProjectGroup[] = [];

      mainProjectMap.forEach((categoryMap, main_project) => {
        const categoryGroups: CategoryGroup[] = [];

        categoryMap.forEach((_, checklist_category) => {
          const catTemplates = templatesByCategory.get(checklist_category) || [];
          if (catTemplates.length === 0) return;

          const docMap = new Map<string, { template: ChecklistTemplate; projectItem: ProjectChecklistItem | null }[]>();
          catTemplates.forEach(t => {
            if (!docMap.has(t.document_name)) {
              docMap.set(t.document_name, []);
            }
            docMap.get(t.document_name)!.push({
              template: t,
              projectItem: projectItemMap.get(t.id) || null,
            });
          });

          const documents: DocumentGroup[] = [];
          docMap.forEach((items, document_name) => {
            documents.push({ document_name, items });
          });

          categoryGroups.push({ checklist_category, documents });
        });

        if (categoryGroups.length > 0) {
          groups.push({ main_project, categories: categoryGroups });
        }
      });

      groups.sort((a, b) => a.main_project.localeCompare(b.main_project, 'zh-Hant'));
      setMainProjectGroups(groups);
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
        categories: mpg.categories.map(cg => ({
          ...cg,
          documents: cg.documents.map(doc => ({
            ...doc,
            items: doc.items.map(item => {
              if (item.template.id !== templateId) return item;
              return { ...item, projectItem: updatedItem };
            }),
          })),
        })),
      }))
    );
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

  const toggleAiCheck = async (template: ChecklistTemplate, projectItem: ProjectChecklistItem | null) => {
    const newChecked = !(projectItem?.is_checked_by_ai ?? false);
    setSavingItem({ id: template.id, type: 'ai' });
    try {
      const updates: Partial<ProjectChecklistItem> = {
        is_checked_by_ai: newChecked,
        ai_checked_at: newChecked ? new Date().toISOString() : null,
      };
      const result = await upsertItem(template, projectItem, updates);
      if (result) updateGroupsWithItem(template.id, result);
    } catch (err) {
      console.error('Error toggling AI check:', err);
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

  const getProgress = (items: { template: ChecklistTemplate; projectItem: ProjectChecklistItem | null }[]) => {
    let total = 0; let userChecked = 0; let aiChecked = 0;
    items.forEach(({ projectItem }) => {
      total++;
      if (projectItem?.is_checked) userChecked++;
      if (projectItem?.is_checked_by_ai) aiChecked++;
    });
    return { total, userChecked, aiChecked };
  };

  const getMainProjectItems = (mpg: MainProjectGroup) =>
    mpg.categories.flatMap(cg => cg.documents.flatMap(doc => doc.items));

  const getCategoryItems = (cg: CategoryGroup) =>
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
          <span>AI verified</span>
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
                  {mpg.categories.map(cg => {
                    const catKey = `${mpg.main_project}::${cg.checklist_category}`;
                    const catItems = getCategoryItems(cg);
                    const catProgress = getProgress(catItems);
                    const catAllDone = catProgress.userChecked === catProgress.total && catProgress.total > 0;
                    const catCollapsed = collapsedCategories.has(catKey);

                    return (
                      <div key={cg.checklist_category}>
                        <button
                          onClick={() => toggle(collapsedCategories, catKey, setCollapsedCategories)}
                          className={`w-full flex items-center justify-between px-6 py-2.5 text-left transition-colors ${
                            catAllDone ? 'bg-green-50/60 hover:bg-green-50' : 'bg-slate-50 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {catCollapsed
                              ? <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              : <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            }
                            <span className={`text-sm font-medium truncate ${catAllDone ? 'text-green-700' : 'text-slate-700'}`}>
                              {cg.checklist_category}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            {catAllDone && <Check className="w-3.5 h-3.5 text-green-600" />}
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
                              const docProgress = getProgress(doc.items);
                              const docAllDone = docProgress.userChecked === docProgress.total && docProgress.total > 0;
                              const docCollapsed = collapsedDocuments.has(docKey);

                              return (
                                <div key={doc.document_name}>
                                  <button
                                    onClick={() => toggle(collapsedDocuments, docKey, setCollapsedDocuments)}
                                    className={`w-full flex items-center justify-between px-8 py-2 text-left transition-colors ${
                                      docAllDone ? 'bg-green-50/40 hover:bg-green-50/60' : 'bg-white hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      {docCollapsed
                                        ? <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
                                        : <ChevronDown className="w-3 h-3 text-slate-300 flex-shrink-0" />
                                      }
                                      <span className={`text-sm truncate ${docAllDone ? 'text-green-600 font-medium' : 'text-slate-600 font-medium'}`}>
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
                                      {doc.items.map(({ template, projectItem }) => {
                                        const isUserChecked = projectItem?.is_checked ?? false;
                                        const isAiChecked = projectItem?.is_checked_by_ai ?? false;
                                        const hasData = !!(projectItem?.data || projectItem?.data_by_ai);
                                        const dataKey = template.id;
                                        const isDataExpanded = expandedData.has(dataKey);
                                        const isSavingUser = savingItem?.id === template.id && savingItem.type === 'user';
                                        const isSavingAi = savingItem?.id === template.id && savingItem.type === 'ai';

                                        return (
                                          <div key={template.id} className={`border-t border-slate-50 transition-colors ${isUserChecked ? 'bg-green-50/20' : ''}`}>
                                            <div className="flex items-start gap-3 px-10 py-2.5">
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

                                                <button
                                                  onClick={() => toggleAiCheck(template, projectItem)}
                                                  disabled={!!savingItem}
                                                  title="AI check"
                                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                                    isAiChecked
                                                      ? 'bg-amber-400 border-amber-400'
                                                      : 'border-slate-300 hover:border-amber-400 bg-white'
                                                  }`}
                                                >
                                                  {isSavingAi ? (
                                                    <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                                                  ) : isAiChecked ? (
                                                    <Bot className="w-2.5 h-2.5 text-white" />
                                                  ) : (
                                                    <Bot className="w-2.5 h-2.5 text-slate-300" />
                                                  )}
                                                </button>
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
                                              </div>
                                            </div>

                                            {isDataExpanded && hasData && (
                                              <div className="mx-10 mb-2 space-y-1.5">
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
