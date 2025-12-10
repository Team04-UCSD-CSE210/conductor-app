(function() {
  'use strict';

  if (globalThis.DashboardService === undefined) {
    console.error('DashboardService not loaded. TODO widget will be disabled.');
    return;
  }

  const {
    getDashboardTodos,
    createDashboardTodo,
    updateDashboardTodo,
    deleteDashboardTodo
  } = globalThis.DashboardService;

  function createTodoDomItem(todo) {
    const item = document.createElement('div');
    item.className = 'todo-item';
    item.dataset.todoId = todo.id;

    const checkbox = document.createElement('button');
    checkbox.type = 'button';
    checkbox.className = 'todo-checkbox';
    checkbox.setAttribute('aria-pressed', todo.is_completed ? 'true' : 'false');

    const textInput = document.createElement('textarea');
    textInput.className = 'todo-text';
    textInput.value = todo.title || '';

    // Auto-size textarea to fit content up to a reasonable max height
    const autoResize = () => {
      const baseHeight = 24; // minimum height so text is always visible
      const maxHeight = 6 * 16; // ~6 lines at 16px
      textInput.style.height = 'auto';
      const h = Math.max(textInput.scrollHeight, baseHeight);
      textInput.style.height = Math.min(h, maxHeight) + 'px';
    };

    if (todo.is_completed) {
      item.classList.add('completed');
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'todo-delete';
    deleteBtn.textContent = '×';
    deleteBtn.setAttribute('aria-label', 'Delete todo');

    item.appendChild(checkbox);
    item.appendChild(textInput);
    item.appendChild(deleteBtn);

    // Toggle completion
    checkbox.addEventListener('click', async () => {
      const newCompleted = !todo.is_completed;
      item.classList.toggle('completed', newCompleted);
      checkbox.setAttribute('aria-pressed', newCompleted ? 'true' : 'false');
      todo.is_completed = newCompleted;
      try {
        await updateDashboardTodo(todo.id, { is_completed: newCompleted });
      } catch (err) {
        console.error('Failed to update todo completion', err);
      }
    });

    // Edit title (blur or Enter)
    const saveTitle = async () => {
      const newTitle = textInput.value.trim();
      if (!newTitle || newTitle === todo.title) {
        textInput.value = todo.title;
        return;
      }
      todo.title = newTitle;
      try {
        await updateDashboardTodo(todo.id, { title: newTitle });
      } catch (err) {
        console.error('Failed to update todo title', err);
      }
    };

    textInput.addEventListener('blur', saveTitle);
    textInput.addEventListener('input', autoResize);

    // Delete
    deleteBtn.addEventListener('click', async () => {
      item.remove();
      try {
        await deleteDashboardTodo(todo.id);
      } catch (err) {
        console.error('Failed to delete todo', err);
      }
    });

    // Ensure initial height is correct once element is in the DOM
    // (defer to next frame so styles/layout are applied)
    queueMicrotask(autoResize);

    return item;
  }

  async function initTodoCard(card) {
    const list = card.querySelector('.todo-list');
    if (!list) {
      console.warn('Todo list not found in card');
      return;
    }

    // Clear any placeholder items
    list.innerHTML = '';

    // Check if add button already exists to avoid duplicates
    let addButton = card.querySelector('.todo-add');
    if (!addButton) {
      addButton = document.createElement('button');
      addButton.type = 'button';
      addButton.className = 'todo-add';
      addButton.textContent = 'Add item';
      addButton.setAttribute('aria-label', 'Add new todo item');

      const addNewTodo = async () => {
        const title = 'New task';
        try {
          const created = await createDashboardTodo(title);
          if (created) {
            const item = createTodoDomItem(created);
            list.appendChild(item);
            const input = item.querySelector('.todo-text');
            if (input) {
              input.focus();
              input.select();
            }
          } else {
            console.error('Failed to create todo: no response');
            alert('Failed to create todo item. Please try again.');
          }
        } catch (err) {
          console.error('Failed to create todo', err);
          alert('Failed to create todo item. Please try again.');
        }
      };

      addButton.addEventListener('click', addNewTodo);

      // Attach add button after the list
      card.appendChild(addButton);
    }

    try {
      const todos = await getDashboardTodos();
      todos.forEach((todo) => {
        const item = createTodoDomItem(todo);
        list.appendChild(item);
      });
    } catch (err) {
      console.error('Failed to load dashboard todos', err);
    }
  }

  function bootstrap() {
    const cards = document.querySelectorAll('.dashboard-card.todo-card');
    cards.forEach(initTodoCard);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();


