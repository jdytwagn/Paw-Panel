(() => {
  const tab = document.getElementById('tab-manage');
  const table = document.getElementById('todo-manager-table');
  const count = document.getElementById('todo-manager-count');
  const empty = document.getElementById('todo-manager-empty');
  const search = document.getElementById('todo-manager-search');
  const filter = document.getElementById('todo-manager-status');
  const add = document.getElementById('todo-manager-add');
  const dialog = document.getElementById('todo-manage-dialog');
  const form = document.getElementById('todo-manage-form');
  const title = document.getElementById('todo-manage-title');
  const error = document.getElementById('todo-manage-error');
  const remove = document.getElementById('todo-manage-delete');
  const categories = document.getElementById('todo-manage-categories');
  const categoryCurrent = document.getElementById('todo-manage-category-current');
  const categoryOptions = document.getElementById('todo-manage-category-options');
  const categoryRename = document.getElementById('todo-manage-category-rename');
  const categoryEditor = document.getElementById('todo-manage-category-editor');
  const categoryName = document.getElementById('todo-manage-category-name');
  const fields = form.elements;
  const groupExpansion = new Map();
  const statuses = { open: '待开始', doing: '进行中', done: '已完成' };
  const dayKey = window.NotchDomain.todoDateKey;
  let edit = null;
  let focusTarget = null;

  function statusOf(task) {
    if (task.done) return 'done';
    return task.status === 'doing' ? 'doing' : 'open';
  }

  function dateTimeInput(value) {
    const day = dayKey(value);
    return day ? `${day}T${formatTodoTime(value)}` : '';
  }

  function cell(value) {
    const safe = escapeHtml(value || '');
    return `<td title="${safe}">${safe || '<span class="todo-manager-dash">—</span>'}</td>`;
  }

  function row(category, task) {
    const status = statusOf(task);
    const name = escapeHtml(task.text);
    const id = escapeHtml(task.id);
    return `<tr class="todo-manager-row" data-task-id="${id}" data-done="${task.done}">
      <th scope="row"><div class="todo-manager-task-cell">
        <button class="checkbox" type="button" data-manager-action="toggle" aria-label="${task.done ? '恢复未完成' : '标记完成'}：${name}" aria-pressed="${task.done}">${checkSvg()}</button>
        <button class="todo-manager-task" type="button" data-edit-category="${category}" data-id="${id}" title="${name}">${name}</button>
      </div></th>
      ${cell(task.summary)}${cell(task.risk)}${cell(task.owner)}
      <td><span class="todo-manager-pill" data-status="${status}">${statuses[status]}</span></td>
      ${cell(task.startDate)}${cell(dateTimeInput(task.deadline).replace('T', ' '))}
      <td class="todo-manager-actions"><button class="delete" type="button" data-manager-action="delete" aria-label="删除：${name}">×</button></td>
    </tr>`;
  }

  function render() {
    if (!tab.classList.contains('active')) return;
    const keyword = search.value.trim().toLocaleLowerCase();
    const progress = filter.value;
    let shown = 0;
    let total = 0;
    const groups = PRIORITIES.map((category) => {
      const managed = data[category].filter(isManagedTodo);
      total += managed.length;
      const matching = window.NotchDomain.sortTodosForDisplay(managed.filter((task) => (
        (!progress || statusOf(task) === progress) &&
        (!keyword || [task.text, task.summary, task.risk, task.owner].some((field) => field?.toLocaleLowerCase().includes(keyword)))
      ))).sort((a, b) => Number(a.done) - Number(b.done) ||
        (a.done ? (a.completedAt || 0) - (b.completedAt || 0) : 0));
      shown += matching.length;
      if ((keyword || progress) && !matching.length) return '';
      const expanded = groupExpansion.get(category) ?? matching.length > 0;
      const group = escapeHtml(todoCategoryNames[category]);
      return `<tbody data-group="${category}">
        <tr class="todo-manager-group"><th scope="rowgroup">
          <div class="todo-manager-group-label"><span class="dot dot-${category.toLowerCase()}" aria-hidden="true"></span>
            <span title="${group}">${group}</span><span class="todo-manager-group-count">${matching.length} 项</span></div>
        </th><td colspan="6"></td><td class="todo-manager-actions">
          <button type="button" data-group-toggle="${category}" aria-label="${expanded ? '收起' : '展开'}${group}" aria-expanded="${expanded}">${expanded ? '收起' : '展开'}</button>
        </td></tr>
        ${expanded ? matching.map((task) => row(category, task)).join('') : ''}
        ${expanded ? `<tr><td colspan="8"><button type="button" class="todo-manager-add-row" data-add-category="${category}" aria-label="添加${group}任务">＋ 添加任务</button></td></tr>` : ''}
      </tbody>`;
    });
    table.querySelectorAll('tbody').forEach((body) => body.remove());
    table.insertAdjacentHTML('beforeend', groups.join(''));
    count.textContent = keyword || progress ? `${shown} / ${total} 项` : `${total} 项`;
    empty.hidden = shown > 0 || !(keyword || progress);
  }

  function renderCategories(category) {
    fields.category.value = category;
    categoryCurrent.textContent = todoCategoryNames[category];
    categoryEditor.hidden = true;
    categoryOptions.innerHTML = PRIORITIES.map((key) => `
      <button type="button" data-pick-category="${key}" aria-pressed="${key === category}">
        <span class="dot dot-${key.toLowerCase()}" aria-hidden="true"></span><span>${escapeHtml(todoCategoryNames[key])}</span>
        ${key === category ? checkSvg().replace('<svg ', '<svg aria-hidden="true" ') : ''}
      </button>`).join('');
  }

  function openEditor(category, id = '', trigger = add) {
    const task = data[category].find((item) => item.id === id && isManagedTodo(item));
    edit = task ? { category, id } : null;
    focusTarget = trigger;
    title.textContent = edit ? '编辑任务' : '新建任务';
    categories.open = false;
    renderCategories(category);
    fields.status.value = task ? statusOf(task) : 'open';
    fields.deadline.value = dateTimeInput(task?.deadline);
    for (const key of ['text', 'summary', 'risk', 'owner', 'startDate']) fields[key].value = task?.[key] || '';
    error.hidden = true;
    remove.hidden = !edit;
    dialog.showModal();
    fields.text.focus();
  }

  function showError(message) {
    error.textContent = message;
    error.hidden = false;
  }

  categoryOptions.addEventListener('click', (event) => {
    const option = event.target.closest('[data-pick-category]');
    if (!option) return;
    renderCategories(option.dataset.pickCategory);
    categoryOptions.querySelector('[aria-pressed="true"]').focus({ preventScroll: true });
  });
  categoryRename.addEventListener('click', () => {
    categoryEditor.hidden = false;
    categoryName.value = todoCategoryNames[fields.category.value];
    categoryName.focus();
    categoryName.select();
  });
  function saveCategoryName() {
    if (!categoryName.value.trim()) {
      showError('请输入分类名称。');
      categoryName.focus();
      return;
    }
    const category = fields.category.value;
    renameTodoCategory(category, categoryName.value);
    renderCategories(category);
    error.hidden = true;
    categoryRename.focus({ preventScroll: true });
  }
  document.getElementById('todo-manage-category-save').addEventListener('click', saveCategoryName);
  categoryName.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    saveCategoryName();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = fields.text.value.trim();
    const category = fields.category.value;
    if (!text) {
      showError('请输入任务描述。');
      fields.text.focus();
      return;
    }
    const previousList = edit ? data[edit.category] : data[category];
    const index = edit ? previousList.findIndex((item) => item.id === edit.id && isManagedTodo(item)) : -1;
    if (edit && index < 0) {
      showError('任务已被删除。请关闭编辑窗口。');
      return;
    }
    const previous = previousList[index];
    const deadlineInput = fields.deadline.value;
    const deadlineMs = Date.parse(deadlineInput);
    const startDate = fields.startDate.value;
    if (deadlineInput && (!Number.isFinite(deadlineMs) || dateTimeInput(deadlineMs) !== deadlineInput)) {
      showError('请输入有效的预计完成时间。');
      return;
    }
    if (startDate && deadlineInput && startDate > deadlineInput.slice(0, 10)) {
      showError('预计开始日期应早于或等于预计完成日期。');
      return;
    }
    const deadline = deadlineInput === dateTimeInput(previous?.deadline)
      ? previous?.deadline || ''
      : deadlineInput ? new Date(deadlineMs).toISOString() : '';
    const progress = fields.status.value;
    const task = {
      ...previous,
      id: previous?.id || generateId(),
      scope: 'managed',
      text,
      createdAt: previous?.createdAt ?? Date.now(),
      done: progress === 'done',
      status: progress === 'doing' ? progress : '',
      deadline,
      remindedAt: previous?.deadline === deadline ? previous.remindedAt : 0,
      startDate,
      summary: fields.summary.value.trim(),
      risk: fields.risk.value.trim(),
      owner: fields.owner.value.trim(),
    };
    if (task.done) task.completedAt = previous?.done ? previous.completedAt : Date.now();
    else delete task.completedAt;
    const nextList = data[category];
    if (previous) previousList.splice(index, 1);
    const nextIndex = previous && previousList === nextList ? index : nextList.length;
    nextList.splice(nextIndex, 0, task);
    if (!saveData(data)) {
      nextList.splice(nextIndex, 1);
      if (previous) previousList.splice(index, 0, previous);
      showError('本机存储写入失败，请重试。');
      return;
    }
    groupExpansion.set(category, true);
    render();
    focusTarget = table.querySelector(`[data-edit-category="${category}"][data-id="${CSS.escape(task.id)}"]`) || add;
    dialog.close();
    showStatusToast('已保存任务');
  });

  table.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const { groupToggle, addCategory, editCategory, id, managerAction } = button.dataset;
    if (groupToggle) {
      groupExpansion.set(groupToggle, button.getAttribute('aria-expanded') !== 'true');
      render();
      table.querySelector(`[data-group-toggle="${groupToggle}"]`)?.focus({ preventScroll: true });
    } else if (addCategory || editCategory) {
      openEditor(addCategory || editCategory, id, button);
    } else if (managerAction) {
      const row = button.closest('[data-task-id]');
      const category = row.closest('tbody').dataset.group;
      const taskId = row.dataset.taskId;
      const nearbyId = (row.nextElementSibling?.dataset.taskId || row.previousElementSibling?.dataset.taskId);
      if (managerAction === 'toggle') toggleTodo(category, taskId);
      else deleteTodo(category, taskId);
      const focusId = managerAction === 'toggle' ? taskId : nearbyId;
      const nextButton = focusId && table.querySelector(`[data-task-id="${CSS.escape(focusId)}"] [data-manager-action="${managerAction}"]`);
      (nextButton || table.querySelector(`[data-group-toggle="${category}"]`) || add).focus({ preventScroll: true });
    }
  });
  search.addEventListener('input', render);
  filter.addEventListener('change', render);
  add.addEventListener('click', () => openEditor(PRIORITIES[0]));
  document.getElementById('todo-manage-cancel').addEventListener('click', () => dialog.close());
  remove.addEventListener('click', () => {
    if (!edit) return;
    deleteTodo(edit.category, edit.id);
    dialog.close();
  });
  dialog.addEventListener('close', () => {
    if (tab.classList.contains('active') && isExpanded) {
      (focusTarget?.isConnected ? focusTarget : add).focus({ preventScroll: true });
    }
    edit = null;
    focusTarget = null;
  });
  document.addEventListener('notch:todos-changed', render);
  document.addEventListener('notch:tabchange', render);
  document.addEventListener('notch:modechange', (event) => {
    if (!event.detail.expanded && dialog.open) dialog.close();
  });
})();
