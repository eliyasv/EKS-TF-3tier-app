import React from 'react';

const TaskList = ({ tasks, onToggle, onDelete, updatingTaskId, deletingTaskId }) => {
  return (
    <ul className="task-list">
      {tasks.map((task) => {
        const isUpdating = updatingTaskId === task._id;
        const isDeleting = deletingTaskId === task._id;

        return (
          <li
            key={task._id}
            className={`task-item ${task.completed ? 'task-item-completed' : ''}`}
          >
            <label className="task-toggle">
              <input
                type="checkbox"
                checked={Boolean(task.completed)}
                onChange={() => onToggle(task)}
                disabled={isUpdating || isDeleting}
              />
              <span>{task.text}</span>
            </label>
            <button
              type="button"
              onClick={() => onDelete(task._id)}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default TaskList;
