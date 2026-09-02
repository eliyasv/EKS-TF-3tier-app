import React, { useState, useEffect } from 'react';
import axios from 'axios';
import TaskList from './TaskList';
import './App.css';

function App() {
  const [tasks, setTasks] = useState([]);
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
  ];

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'active') return !task.completed;
    if (filter === 'completed') return task.completed;
    return true;
  });

  const activeTaskCount = tasks.filter((task) => !task.completed).length;

  useEffect(() => {
    const loadTasks = async () => {
      try {
        setError('');
        const res = await axios.get('/api/tasks');
        setTasks(res.data);
      } catch (err) {
        setError('Could not load tasks. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadTasks();
  }, []);

  const addTask = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    try {
      setIsSaving(true);
      setError('');
      const res = await axios.post('/api/tasks', { text });
      setTasks([res.data, ...tasks]);
      setText('');
    } catch (err) {
      setError('Could not add the task. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTask = async (id) => {
    try {
      setDeletingTaskId(id);
      setError('');
      await axios.delete(`/api/tasks/${id}`);
      setTasks(tasks.filter((task) => task._id !== id));
    } catch (err) {
      setError('Could not delete the task. Please try again.');
    } finally {
      setDeletingTaskId(null);
    }
  };

  const toggleTask = async (task) => {
    try {
      setUpdatingTaskId(task._id);
      setError('');
      const res = await axios.patch(`/api/tasks/${task._id}`, {
        completed: !task.completed,
      });
      setTasks(tasks.map((item) => (item._id === task._id ? res.data : item)));
    } catch (err) {
      setError('Could not update the task. Please try again.');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  return (
    <div className="app-shell">
      <main className="todo-panel">
        <h1>Todo App</h1>

        <form className="task-form" onSubmit={addTask}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter task"
            disabled={isSaving}
            aria-label="Task text"
          />
          <button type="submit" disabled={isSaving || !text.trim()}>
            {isSaving ? 'Adding...' : 'Add'}
          </button>
        </form>

        {error && <div className="error-message">{error}</div>}

        {isLoading ? (
          <p className="status-message">Loading tasks...</p>
        ) : tasks.length === 0 ? (
          <p className="status-message">No tasks yet.</p>
        ) : (
          <>
            <div className="task-toolbar">
              <div className="filter-tabs" role="group" aria-label="Task filters">
                {filterOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`filter-tab ${
                      filter === option.value ? 'filter-tab-active' : ''
                    }`}
                    onClick={() => setFilter(option.value)}
                    aria-pressed={filter === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <span className="task-count">
                {activeTaskCount} {activeTaskCount === 1 ? 'active task' : 'active tasks'}
              </span>
            </div>

            {filteredTasks.length === 0 ? (
              <p className="status-message">No {filter} tasks.</p>
            ) : (
              <TaskList
                tasks={filteredTasks}
                onToggle={toggleTask}
                onDelete={deleteTask}
                updatingTaskId={updatingTaskId}
                deletingTaskId={deletingTaskId}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
