/**
 * To-Do List Application JavaScript
 * Handles all frontend interactions, AJAX requests, and dynamic UI updates
 */

class TodoApp {
    constructor() {
        // Initialize app state
        this.tasks = [];
        this.currentFilter = 'all';
        this.isLoading = false;
        
        // DOM elements
        this.taskInput = document.getElementById('taskInput');
        this.addTaskBtn = document.getElementById('addTaskBtn');
        this.tasksList = document.getElementById('tasksList');
        this.loadingState = document.getElementById('loadingState');
        this.emptyState = document.getElementById('emptyState');
        this.charCount = document.getElementById('charCount');
        this.clearCompletedBtn = document.getElementById('clearCompleted');
        this.filterBtns = document.querySelectorAll('.filter-btn');
        this.errorMessage = document.getElementById('errorMessage');
        this.successMessage = document.getElementById('successMessage');
        this.confirmModal = document.getElementById('confirmModal');
        
        // Statistics elements
        this.totalTasksEl = document.getElementById('totalTasks');
        this.completedTasksEl = document.getElementById('completedTasks');
        this.pendingTasksEl = document.getElementById('pendingTasks');
        
        // Initialize the application
        this.init();
    }

    /**
     * Initialize the application
     */
    init() {
        this.bindEvents();
        this.loadTasks();
        this.updateCharCounter();
    }

    /**
     * Bind all event listeners
     */
    bindEvents() {
        // Add task events
        this.addTaskBtn.addEventListener('click', () => this.addTask());
        this.taskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });
        this.taskInput.addEventListener('input', () => this.updateCharCounter());

        // Filter events
        this.filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.target.dataset.filter;
                this.setFilter(filter);
            });
        });

        // Clear completed tasks
        this.clearCompletedBtn.addEventListener('click', () => {
            this.showConfirmModal(
                'Are you sure you want to delete all completed tasks? This action cannot be undone.',
                () => this.clearCompletedTasks()
            );
        });

        // Message close buttons
        this.setupMessageCloseButtons();

        // Modal events
        this.setupModalEvents();

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'Enter':
                        e.preventDefault();
                        this.addTask();
                        break;
                    case 'f':
                        e.preventDefault();
                        this.taskInput.focus();
                        break;
                }
            }
        });
    }

    /**
     * Setup message close button events
     */
    setupMessageCloseButtons() {
        document.querySelector('.error-close').addEventListener('click', () => {
            this.hideMessage('error');
        });
        document.querySelector('.success-close').addEventListener('click', () => {
            this.hideMessage('success');
        });
    }

    /**
     * Setup modal events
     */
    setupModalEvents() {
        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.hideConfirmModal();
        });

        // Close modal when clicking outside
        this.confirmModal.addEventListener('click', (e) => {
            if (e.target === this.confirmModal) {
                this.hideConfirmModal();
            }
        });

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.confirmModal.style.display !== 'none') {
                this.hideConfirmModal();
            }
        });
    }

    /**
     * Update character counter
     */
    updateCharCounter() {
        const length = this.taskInput.value.length;
        this.charCount.textContent = length;
        
        // Change color based on character count
        if (length > 450) {
            this.charCount.style.color = 'var(--danger-color)';
        } else if (length > 400) {
            this.charCount.style.color = 'var(--warning-color)';
        } else {
            this.charCount.style.color = 'var(--text-muted)';
        }
    }

    /**
     * Load all tasks from the server
     */
    async loadTasks() {
        try {
            this.setLoading(true);
            const response = await fetch('/api/tasks');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.tasks = await response.json();
            this.renderTasks();
            this.updateStatistics();
            
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.showMessage('error', 'Failed to load tasks. Please refresh the page.');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Add a new task
     */
    async addTask() {
        const description = this.taskInput.value.trim();
        
        if (!description) {
            this.showMessage('error', 'Please enter a task description.');
            this.taskInput.focus();
            return;
        }

        if (description.length > 500) {
            this.showMessage('error', 'Task description is too long (max 500 characters).');
            return;
        }

        try {
            this.setButtonLoading(this.addTaskBtn, true);
            
            const response = await fetch('/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ description })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to add task');
            }

            const newTask = await response.json();
            
            // Add task to the beginning of the array
            this.tasks.unshift(newTask);
            
            // Clear input and update UI
            this.taskInput.value = '';
            this.updateCharCounter();
            this.renderTasks();
            this.updateStatistics();
            
            this.showMessage('success', 'Task added successfully!');
            
            // Focus back on input for continuous adding
            this.taskInput.focus();
            
        } catch (error) {
            console.error('Error adding task:', error);
            this.showMessage('error', error.message || 'Failed to add task. Please try again.');
        } finally {
            this.setButtonLoading(this.addTaskBtn, false);
        }
    }

    /**
     * Toggle task completion status
     */
    async toggleTask(taskId) {
        try {
            const response = await fetch(`/complete/${taskId}`, {
                method: 'PUT'
            });

            if (!response.ok) {
                throw new Error('Failed to update task');
            }

            const updatedTask = await response.json();
            
            // Update task in local array
            const taskIndex = this.tasks.findIndex(task => task.id === taskId);
            if (taskIndex !== -1) {
                this.tasks[taskIndex] = updatedTask;
                this.renderTasks();
                this.updateStatistics();
                
                const status = updatedTask.completed ? 'completed' : 'pending';
                this.showMessage('success', `Task marked as ${status}!`);
            }

        } catch (error) {
            console.error('Error toggling task:', error);
            this.showMessage('error', 'Failed to update task. Please try again.');
        }
    }

    /**
     * Delete a specific task
     */
    async deleteTask(taskId) {
        try {
            const response = await fetch(`/delete/${taskId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete task');
            }

            // Remove task from local array
            this.tasks = this.tasks.filter(task => task.id !== taskId);
            this.renderTasks();
            this.updateStatistics();
            
            this.showMessage('success', 'Task deleted successfully!');

        } catch (error) {
            console.error('Error deleting task:', error);
            this.showMessage('error', 'Failed to delete task. Please try again.');
        }
    }

    /**
     * Clear all completed tasks
     */
    async clearCompletedTasks() {
        const completedTasks = this.tasks.filter(task => task.completed);
        
        if (completedTasks.length === 0) {
            this.showMessage('error', 'No completed tasks to clear.');
            return;
        }

        try {
            // Delete all completed tasks
            const deletePromises = completedTasks.map(task => 
                fetch(`/delete/${task.id}`, { method: 'DELETE' })
            );

            const responses = await Promise.all(deletePromises);
            
            // Check if all deletions were successful
            const failedDeletions = responses.filter(response => !response.ok);
            if (failedDeletions.length > 0) {
                throw new Error(`Failed to delete ${failedDeletions.length} tasks`);
            }

            // Remove completed tasks from local array
            this.tasks = this.tasks.filter(task => !task.completed);
            this.renderTasks();
            this.updateStatistics();
            
            this.showMessage('success', `${completedTasks.length} completed tasks cleared!`);

        } catch (error) {
            console.error('Error clearing completed tasks:', error);
            this.showMessage('error', 'Failed to clear completed tasks. Please try again.');
        }
    }

    /**
     * Set current filter and update UI
     */
    setFilter(filter) {
        this.currentFilter = filter;
        
        // Update filter button states
        this.filterBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.filter === filter) {
                btn.classList.add('active');
            }
        });
        
        this.renderTasks();
    }

    /**
     * Get filtered tasks based on current filter
     */
    getFilteredTasks() {
        switch (this.currentFilter) {
            case 'completed':
                return this.tasks.filter(task => task.completed);
            case 'pending':
                return this.tasks.filter(task => !task.completed);
            default:
                return this.tasks;
        }
    }

    /**
     * Render tasks in the UI
     */
    renderTasks() {
        const filteredTasks = this.getFilteredTasks();
        
        // Show/hide empty state
        if (filteredTasks.length === 0) {
            this.tasksList.style.display = 'none';
            this.emptyState.style.display = 'block';
            
            // Update empty state message based on filter
            const emptyStateText = this.emptyState.querySelector('p');
            switch (this.currentFilter) {
                case 'completed':
                    emptyStateText.textContent = 'No completed tasks yet!';
                    break;
                case 'pending':
                    emptyStateText.textContent = 'No pending tasks! You\'re all caught up.';
                    break;
                default:
                    emptyStateText.textContent = 'Add your first task above to get started.';
            }
        } else {
            this.tasksList.style.display = 'block';
            this.emptyState.style.display = 'none';
        }

        // Render task items
        this.tasksList.innerHTML = filteredTasks.map(task => this.createTaskHTML(task)).join('');
        
        // Bind events to newly created elements
        this.bindTaskEvents();
        
        // Update clear completed button state
        const hasCompletedTasks = this.tasks.some(task => task.completed);
        this.clearCompletedBtn.disabled = !hasCompletedTasks;
    }

    /**
     * Create HTML for a single task
     */
    createTaskHTML(task) {
        const createdDate = new Date(task.created_at).toLocaleDateString();
        const createdTime = new Date(task.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        return `
            <div class="task-item ${task.completed ? 'completed' : ''}" data-task-id="${task.id}">
                <div class="task-checkbox ${task.completed ? 'checked' : ''}" data-task-id="${task.id}">
                    <i class="fas fa-check"></i>
                </div>
                <div class="task-content">
                    <div class="task-text">${this.escapeHtml(task.description)}</div>
                    <div class="task-meta">Added on ${createdDate} at ${createdTime}</div>
                </div>
                <div class="task-actions">
                    <button class="task-btn complete-btn" data-task-id="${task.id}" title="${task.completed ? 'Mark as pending' : 'Mark as completed'}">
                        <i class="fas ${task.completed ? 'fa-undo' : 'fa-check'}"></i>
                    </button>
                    <button class="task-btn delete-btn" data-task-id="${task.id}" title="Delete task">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Bind events to task elements
     */
    bindTaskEvents() {
        // Checkbox click events
        document.querySelectorAll('.task-checkbox').forEach(checkbox => {
            checkbox.addEventListener('click', (e) => {
                const taskId = parseInt(e.currentTarget.dataset.taskId);
                this.toggleTask(taskId);
            });
        });

        // Complete button events
        document.querySelectorAll('.complete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const taskId = parseInt(e.currentTarget.dataset.taskId);
                this.toggleTask(taskId);
            });
        });

        // Delete button events
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const taskId = parseInt(e.currentTarget.dataset.taskId);
                const task = this.tasks.find(t => t.id === taskId);
                
                this.showConfirmModal(
                    `Are you sure you want to delete "${task.description}"? This action cannot be undone.`,
                    () => this.deleteTask(taskId)
                );
            });
        });
    }

    /**
     * Update task statistics
     */
    updateStatistics() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(task => task.completed).length;
        const pending = total - completed;

        // Animate number changes
        this.animateNumberChange(this.totalTasksEl, total);
        this.animateNumberChange(this.completedTasksEl, completed);
        this.animateNumberChange(this.pendingTasksEl, pending);
    }

    /**
     * Animate number changes in statistics
     */
    animateNumberChange(element, newValue) {
        const currentValue = parseInt(element.textContent) || 0;
        
        if (currentValue === newValue) return;
        
        const duration = 300;
        const steps = 20;
        const stepValue = (newValue - currentValue) / steps;
        const stepTime = duration / steps;
        
        let currentStep = 0;
        const timer = setInterval(() => {
            currentStep++;
            const value = Math.round(currentValue + (stepValue * currentStep));
            element.textContent = value;
            
            if (currentStep >= steps) {
                element.textContent = newValue;
                clearInterval(timer);
            }
        }, stepTime);
    }

    /**
     * Show confirmation modal
     */
    showConfirmModal(message, onConfirm) {
        document.getElementById('confirmMessage').textContent = message;
        this.confirmModal.style.display = 'flex';
        
        // Remove existing event listeners and add new one
        const confirmBtn = document.getElementById('confirmBtn');
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.addEventListener('click', () => {
            onConfirm();
            this.hideConfirmModal();
        });
    }

    /**
     * Hide confirmation modal
     */
    hideConfirmModal() {
        this.confirmModal.style.display = 'none';
    }

    /**
     * Show success or error message
     */
    showMessage(type, text) {
        const messageEl = type === 'error' ? this.errorMessage : this.successMessage;
        const textEl = messageEl.querySelector(`.${type}-text`);
        
        textEl.textContent = text;
        messageEl.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.hideMessage(type);
        }, 5000);
    }

    /**
     * Hide message
     */
    hideMessage(type) {
        const messageEl = type === 'error' ? this.errorMessage : this.successMessage;
        messageEl.style.display = 'none';
    }

    /**
     * Set loading state
     */
    setLoading(isLoading) {
        this.isLoading = isLoading;
        
        if (isLoading) {
            this.loadingState.style.display = 'block';
            this.tasksList.style.display = 'none';
            this.emptyState.style.display = 'none';
        } else {
            this.loadingState.style.display = 'none';
        }
    }

    /**
     * Set button loading state
     */
    setButtonLoading(button, isLoading) {
        if (isLoading) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Adding...</span>';
        } else {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-plus"></i> <span>Add Task</span>';
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TodoApp();
});

// Add some helpful console messages for developers
console.log('📝 To-Do List App loaded successfully!');
console.log('💡 Keyboard shortcuts:');
console.log('   • Ctrl/Cmd + Enter: Add task');
console.log('   • Ctrl/Cmd + F: Focus input field');
console.log('   • Enter (when input focused): Add task');
console.log('   • Escape: Close modal');
