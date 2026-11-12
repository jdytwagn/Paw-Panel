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
  const fields = form.elements;
  const collapsedGroups = new Set();
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
    return `<tr>
      <th scope="row"><button class="todo-manager-task" type="button" data-edit-category="${category}" data-id="${escapeHtml(task.id)}" title="${name}">${name}</button></th>
      ${cell(task.summary)}${cell(task.risk)}${cell(task.owner)}
      <td><span class="todo-manager-pill" data-status="${status}">${statuses[status]}</span></td>
      ${cell(task.startDate)}${cell(dateTimeInput(task.deadline).replace('T', ' '))}
    </tr>`;
  }

  function render() {
    if (!tab.classList.contains('active')) return;
    const keyword = search.value.trim().toLocaleLowerCase();
    const progress = filter.value;
    let shown = 0;
    let total = 0;
    const groups = PRIORITIES.map((category) => {
      total += data[category].length;
      const matching = window.NotchDomain.sortTodosForDisplay(data[category].filter((task) => (
        (!progress || statusOf(task) === progress) &&
        (!keyword || [task.text, task.summary, task.risk, task.owner].some((field) => field?.toLocaleLowerCase().includes(keyword)))
      )));
      shown += matching.length;
      if ((keyword || progress) && !matching.length) return '';
      const expanded = !collapsedGroups.has(category);
      const group = escapeHtml(todoCategoryNames[category]);
      return `<tbody data-group="${category}">
        <tr class="todo-manager-group"><th colspan="7" scope="rowgroup">
          <button type="button" data-group-toggle="${category}" aria-expanded="${expanded}">
            <span class="todo-manager-chevron" aria-hidden="true">⌄</span>
            <span class="dot dot-${category.toLowerCase()}" aria-hidden="true"></span>
            ${group}<span class="todo-manager-group-count">${matching.length} 项</span>
          </button>
        </th></tr>
        ${expanded ? matching.map((task) => row(category, task)).join('') : ''}
        ${expanded ? `<tr><td colspan="7"><button type="button" class="todo-manager-add-row" data-add-category="${category}" aria-label="添加${group}任务">＋ 添加任务</button></td></tr>` : ''}
      </tbody>`;
    });
    table.querySelectorAll('tbody').forEach((body) => body.remove());
    table.insertAdjacentHTML('beforeend', groups.join(''));
    count.textContent = keyword || progress ? `${shown} / ${total} 项` : `${total} 项`;
    empty.hidden = shown > 0 || !(keyword || progress);
  }

  function openEditor(category, id = '', trigger = add) {
    const task = data[category].find((item) => item.id === id);
    edit = task ? { category, id } : null;
    focusTarget = trigger;
    title.textContent = edit ? '编辑任务' : '新建任务';
    fields.category.replaceChildren(...PRIORITIES.map((key) => new Option(todoCategoryNames[key], key)));
    fields.category.value = category;
    fields.status.value = task ? statusOf(task) : 'open';
    fields.deadline.value = dateTimeInput(task ? task.deadline : window.NotchDomain.defaultTodoDeadline());
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
    const index = edit ? previousList.findIndex((item) => item.id === edit.id) : -1;
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
    if (edit) {
      todoSelections[edit.category].delete(edit.id);
      if (todoSelectionAnchors[edit.category] === edit.id) todoSelectionAnchors[edit.category] = null;
    }
    renderAll();
    focusTarget = table.querySelector(`[data-edit-category="${category}"][data-id="${CSS.escape(task.id)}"]`) || add;
    dialog.close();
    showStatusToast('已保存任务');
  });

  table.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const { groupToggle, addCategory, editCategory, id } = button.dataset;
    if (groupToggle) {
      if (collapsedGroups.has(groupToggle)) collapsedGroups.delete(groupToggle);
      else collapsedGroups.add(groupToggle);
      render();
      table.querySelector(`[data-group-toggle="${groupToggle}"]`)?.focus({ preventScroll: true });
    } else if (addCategory || editCategory) {
      openEditor(addCategory || editCategory, id, button);
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
