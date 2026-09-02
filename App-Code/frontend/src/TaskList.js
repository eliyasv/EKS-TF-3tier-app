import React from 'react';

const TaskList = ({ tasks, onDelete, deletingTaskId }) => {
  return (
    <ul className="task-list">
      {tasks.map((task) => {
        const isDeleting = deletingTaskId === task._id;

        return (
          <li key={task._id} className="task-item">
            <span>{task.text}</span>
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
