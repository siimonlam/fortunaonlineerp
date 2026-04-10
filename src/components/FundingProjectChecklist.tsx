import { useState, useEffect, useCallback } from 'react';
import { Check, ChevronDown, ChevronRight, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
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
  notes: string;
  checked_by: string | null;
  checked_at: string | null;
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
  const [saving, setSaving] = useState<string | null>(null);
  const [mainProjectGroups, setMainProjectGroups] = useState<MainProjectGroup[]>([]);
  const [hasProjectDetails, setHasProjectDetails] = useState(true);
  const [collapsedMain, setCollapsedMain] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [collapsedDocuments, setCollapsedDocuments] = useState<Set<string>>(new Set());

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
    loadChecklist();
  }, [loadChecklist]);

  const toggleItem = async (template: ChecklistTemplate, projectItem: ProjectChecklistItem | null) => {
    const newChecked = projectItem ? !projectItem.is_checked : true;
    setSaving(template.id);

    try {
      if (projectItem) {
        const { error } = await supabase
          .from('project_checklist_items')
          .update({
            is_checked: newChecked,
            checked_by: newChecked ? (await supabase.auth.getUser()).data.user?.id : null,
            checked_at: newChecked ? new Date().toISOString() : null,
          })
          .eq('id', projectItem.id);
        if (error) throw error;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await supabase
          .from('project_checklist_items')
          .insert({
            project_id: projectId,
            checklist_id: template.id,
            category: template.category,
            document_name: template.document_name,
            description: template.description,
            is_checked: true,
            checked_by: userData.user?.id || null,
            checked_at: new Date().toISOString(),
          });
        if (error) throw error;
      }

      setMainProjectGroups(prev =>
        prev.map(mpg => ({
          ...mpg,
          categories: mpg.categories.map(cg => ({
            ...cg,
            documents: cg.documents.map(doc => ({
              ...doc,
              items: doc.items.map(item => {
                if (item.template.id !== template.id) return item;
                return {
                  ...item,
                  projectItem: item.projectItem
                    ? { ...item.projectItem, is_checked: newChecked }
                    : {
                        id: '',
                        project_id: projectId,
                        checklist_id: template.id,
                        is_checked: true,
                        notes: '',
                        checked_by: null,
                        checked_at: null,
                      },
                };
              }),
            })),
          })),
        }))
      );
    } catch (err) {
      console.error('Error toggling checklist item:', err);
    } finally {
      setSaving(null);
    }
  };

  const toggle = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  };

  const getMainProjectProgress = (mpg: MainProjectGroup) => {
    let total = 0; let checked = 0;
    mpg.categories.forEach(cg =>
      cg.documents.forEach(doc =>
        doc.items.forEach(item => {
          total++;
          if (item.projectItem?.is_checked) checked++;
        })
      )
    );
    return { total, checked };
  };

  const getCategoryProgress = (cg: CategoryGroup) => {
    let total = 0; let checked = 0;
    cg.documents.forEach(doc =>
      doc.items.forEach(item => {
        total++;
        if (item.projectItem?.is_checked) checked++;
      })
    );
    return { total, checked };
  };

  const getDocumentProgress = (doc: DocumentGroup) => {
    const total = doc.items.length;
    const checked = doc.items.filter(i => i.projectItem?.is_checked).length;
    return { total, checked };
  };

  const getTotalProgress = () => {
    let total = 0; let checked = 0;
    mainProjectGroups.forEach(mpg => {
      const p = getMainProjectProgress(mpg);
      total += p.total;
      checked += p.checked;
    });
    return { total, checked };
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

  const { total, checked } = getTotalProgress();
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Document Checklist</h3>
          <p className="text-sm text-slate-500 mt-0.5">{checked} / {total} criteria verified</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">{pct}%</div>
            <div className="text-xs text-slate-400">complete</div>
          </div>
          <button
            onClick={loadChecklist}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="w-full bg-slate-200 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="space-y-3">
        {mainProjectGroups.map(mpg => {
          const mpProgress = getMainProjectProgress(mpg);
          const mpAllDone = mpProgress.checked === mpProgress.total && mpProgress.total > 0;
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
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    mpAllDone ? 'bg-green-100 text-green-700' : 'bg-white text-slate-600'
                  }`}>
                    {mpProgress.checked}/{mpProgress.total}
                  </span>
                </div>
              </button>

              {!mpCollapsed && (
                <div className="divide-y divide-slate-100">
                  {mpg.categories.map(cg => {
                    const catKey = `${mpg.main_project}::${cg.checklist_category}`;
                    const catProgress = getCategoryProgress(cg);
                    const catAllDone = catProgress.checked === catProgress.total && catProgress.total > 0;
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
                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                            {catAllDone && <Check className="w-3.5 h-3.5 text-green-600" />}
                            <span className={`text-xs ${catAllDone ? 'text-green-600' : 'text-slate-400'}`}>
                              {catProgress.checked}/{catProgress.total}
                            </span>
                          </div>
                        </button>

                        {!catCollapsed && (
                          <div className="divide-y divide-slate-50">
                            {cg.documents.map(doc => {
                              const docKey = `${catKey}::${doc.document_name}`;
                              const docProgress = getDocumentProgress(doc);
                              const docAllDone = docProgress.checked === docProgress.total && docProgress.total > 0;
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
                                    <span className={`text-xs flex-shrink-0 ml-2 ${docAllDone ? 'text-green-500' : 'text-slate-300'}`}>
                                      {docProgress.checked}/{docProgress.total}
                                    </span>
                                  </button>

                                  {!docCollapsed && (
                                    <div className="bg-white">
                                      {doc.items.map(({ template, projectItem }) => {
                                        const isChecked = projectItem?.is_checked ?? false;
                                        const isSavingThis = saving === template.id;

                                        return (
                                          <div
                                            key={template.id}
                                            className={`flex items-center gap-3 px-10 py-2 border-t border-slate-50 transition-colors ${
                                              isChecked ? 'bg-green-50/30' : 'hover:bg-slate-50'
                                            }`}
                                          >
                                            <button
                                              onClick={() => toggleItem(template, projectItem)}
                                              disabled={isSavingThis}
                                              className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                                isChecked
                                                  ? 'bg-green-500 border-green-500'
                                                  : 'border-slate-300 hover:border-blue-400 bg-white'
                                              }`}
                                            >
                                              {isSavingThis ? (
                                                <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                                              ) : isChecked ? (
                                                <Check className="w-3 h-3 text-white" />
                                              ) : null}
                                            </button>
                                            <span className={`text-sm ${isChecked ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                              {template.description}
                                            </span>
                                            {template.is_required && !isChecked && (
                                              <span className="ml-auto flex-shrink-0 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                                Required
                                              </span>
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
