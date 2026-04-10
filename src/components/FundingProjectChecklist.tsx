import { useState, useEffect, useCallback } from 'react';
import { Check, ChevronDown, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
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
  category: string;
  document_name: string;
  description: string;
  is_checked: boolean;
  notes: string;
  checked_by: string | null;
  checked_at: string | null;
}

interface FundingProjectChecklistProps {
  projectId: string;
}

interface CategoryGroup {
  category: string;
  documents: {
    document_name: string;
    items: {
      template: ChecklistTemplate;
      projectItem: ProjectChecklistItem | null;
    }[];
  }[];
}

export default function FundingProjectChecklist({ projectId }: FundingProjectChecklistProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [collapsedDocuments, setCollapsedDocuments] = useState<Set<string>>(new Set());

  const loadChecklist = useCallback(async () => {
    setLoading(true);
    try {
      const [templatesRes, projectItemsRes] = await Promise.all([
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

      const templates: ChecklistTemplate[] = templatesRes.data || [];
      const projectItems: ProjectChecklistItem[] = projectItemsRes.data || [];

      const projectItemMap = new Map<string, ProjectChecklistItem>();
      projectItems.forEach(item => {
        projectItemMap.set(item.checklist_id, item);
      });

      const categoryMap = new Map<string, Map<string, { template: ChecklistTemplate; projectItem: ProjectChecklistItem | null }[]>>();

      templates.forEach(template => {
        if (!categoryMap.has(template.category)) {
          categoryMap.set(template.category, new Map());
        }
        const docMap = categoryMap.get(template.category)!;
        if (!docMap.has(template.document_name)) {
          docMap.set(template.document_name, []);
        }
        docMap.get(template.document_name)!.push({
          template,
          projectItem: projectItemMap.get(template.id) || null,
        });
      });

      const groups: CategoryGroup[] = [];
      categoryMap.forEach((docMap, category) => {
        const documents: CategoryGroup['documents'] = [];
        docMap.forEach((items, document_name) => {
          documents.push({ document_name, items });
        });
        groups.push({ category, documents });
      });

      groups.sort((a, b) => a.category.localeCompare(b.category, 'zh-Hant'));

      setCategoryGroups(groups);
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
        const { data: user } = await supabase.auth.getUser();
        const { error } = await supabase
          .from('project_checklist_items')
          .insert({
            project_id: projectId,
            checklist_id: template.id,
            category: template.category,
            document_name: template.document_name,
            description: template.description,
            is_checked: true,
            checked_by: user.user?.id || null,
            checked_at: new Date().toISOString(),
          });
        if (error) throw error;
      }

      setCategoryGroups(prev =>
        prev.map(group => ({
          ...group,
          documents: group.documents.map(doc => ({
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
                      category: template.category,
                      document_name: template.document_name,
                      description: template.description,
                      is_checked: true,
                      notes: '',
                      checked_by: null,
                      checked_at: null,
                    },
              };
            }),
          })),
        }))
      );
    } catch (err) {
      console.error('Error toggling checklist item:', err);
    } finally {
      setSaving(null);
    }
  };

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const toggleDocument = (key: string) => {
    setCollapsedDocuments(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getCategoryProgress = (group: CategoryGroup) => {
    let total = 0;
    let checked = 0;
    group.documents.forEach(doc => {
      doc.items.forEach(item => {
        total++;
        if (item.projectItem?.is_checked) checked++;
      });
    });
    return { total, checked };
  };

  const getDocumentProgress = (doc: CategoryGroup['documents'][0]) => {
    const total = doc.items.length;
    const checked = doc.items.filter(i => i.projectItem?.is_checked).length;
    return { total, checked };
  };

  const getTotalProgress = () => {
    let total = 0;
    let checked = 0;
    categoryGroups.forEach(group => {
      const p = getCategoryProgress(group);
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
        {categoryGroups.map(group => {
          const catProgress = getCategoryProgress(group);
          const isCollapsed = collapsedCategories.has(group.category);
          const allDone = catProgress.checked === catProgress.total && catProgress.total > 0;

          return (
            <div key={group.category} className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleCategory(group.category)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                  allDone ? 'bg-green-50 hover:bg-green-100' : 'bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isCollapsed
                    ? <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  }
                  <span className={`font-medium text-sm truncate ${allDone ? 'text-green-700' : 'text-slate-800'}`}>
                    {group.category}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {allDone && <Check className="w-4 h-4 text-green-600" />}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    allDone ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {catProgress.checked}/{catProgress.total}
                  </span>
                </div>
              </button>

              {!isCollapsed && (
                <div className="divide-y divide-slate-100">
                  {group.documents.map(doc => {
                    const docKey = `${group.category}::${doc.document_name}`;
                    const docProgress = getDocumentProgress(doc);
                    const isDocCollapsed = collapsedDocuments.has(docKey);
                    const docAllDone = docProgress.checked === docProgress.total && docProgress.total > 0;

                    return (
                      <div key={doc.document_name}>
                        <button
                          onClick={() => toggleDocument(docKey)}
                          className={`w-full flex items-center justify-between px-6 py-2.5 text-left transition-colors ${
                            docAllDone ? 'bg-green-50/50 hover:bg-green-50' : 'bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isDocCollapsed
                              ? <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                              : <ChevronDown className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                            }
                            <span className={`text-sm font-medium truncate ${docAllDone ? 'text-green-700' : 'text-slate-700'}`}>
                              {doc.document_name}
                            </span>
                          </div>
                          <span className={`text-xs flex-shrink-0 ml-2 ${docAllDone ? 'text-green-600' : 'text-slate-400'}`}>
                            {docProgress.checked}/{docProgress.total}
                          </span>
                        </button>

                        {!isDocCollapsed && (
                          <div className="bg-white">
                            {doc.items.map(({ template, projectItem }) => {
                              const isChecked = projectItem?.is_checked ?? false;
                              const isSavingThis = saving === template.id;

                              return (
                                <div
                                  key={template.id}
                                  className={`flex items-center gap-3 px-8 py-2 border-t border-slate-50 transition-colors ${
                                    isChecked ? 'bg-green-50/40' : 'hover:bg-slate-50'
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
                                  <span className={`text-sm ${isChecked ? 'text-slate-500 line-through' : 'text-slate-700'}`}>
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
    </div>
  );
}
