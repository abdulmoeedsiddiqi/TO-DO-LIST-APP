"""
Flask To-Do List Application
A complete web application for managing tasks with SQLite database
"""

from flask import Flask, render_template, request, jsonify, redirect, url_for
import sqlite3
import os

app = Flask(__name__)

# Database configuration
DATABASE = 'tasks.db'

def init_db():
    """Initialize the SQLite database with tasks table"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Create tasks table if it doesn't exist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            description TEXT NOT NULL,
            completed BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

def get_db_connection():
    """Get database connection with row factory for dict-like access"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/')
def index():
    """Main route - Display the to-do list page"""
    return render_template('index.html')

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    """API route to fetch all tasks"""
    conn = get_db_connection()
    tasks = conn.execute(
        'SELECT * FROM tasks ORDER BY created_at DESC'
    ).fetchall()
    conn.close()
    
    # Convert to list of dictionaries for JSON response
    tasks_list = [
        {
            'id': task['id'],
            'description': task['description'],
            'completed': bool(task['completed']),
            'created_at': task['created_at']
        }
        for task in tasks
    ]
    
    return jsonify(tasks_list)

@app.route('/add', methods=['POST'])
def add_task():
    """POST route to add a new task"""
    data = request.get_json()
    description = data.get('description', '').strip()
    
    if not description:
        return jsonify({'error': 'Task description cannot be empty'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Insert new task
    cursor.execute(
        'INSERT INTO tasks (description, completed) VALUES (?, ?)',
        (description, False)
    )
    
    # Get the newly created task
    task_id = cursor.lastrowid
    new_task = cursor.execute(
        'SELECT * FROM tasks WHERE id = ?', (task_id,)
    ).fetchone()
    
    conn.commit()
    conn.close()
    
    # Return the new task data
    task_data = {
        'id': new_task['id'],
        'description': new_task['description'],
        'completed': bool(new_task['completed']),
        'created_at': new_task['created_at']
    }
    
    return jsonify(task_data), 201

@app.route('/complete/<int:task_id>', methods=['PUT'])
def complete_task(task_id):
    """Route to mark a task as completed or toggle completion status"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get current task status
    task = cursor.execute(
        'SELECT * FROM tasks WHERE id = ?', (task_id,)
    ).fetchone()
    
    if not task:
        conn.close()
        return jsonify({'error': 'Task not found'}), 404
    
    # Toggle completion status
    new_status = not bool(task['completed'])
    cursor.execute(
        'UPDATE tasks SET completed = ? WHERE id = ?',
        (new_status, task_id)
    )
    
    # Get updated task
    updated_task = cursor.execute(
        'SELECT * FROM tasks WHERE id = ?', (task_id,)
    ).fetchone()
    
    conn.commit()
    conn.close()
    
    task_data = {
        'id': updated_task['id'],
        'description': updated_task['description'],
        'completed': bool(updated_task['completed']),
        'created_at': updated_task['created_at']
    }
    
    return jsonify(task_data)

@app.route('/delete/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    """Route to delete a task"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if task exists
    task = cursor.execute(
        'SELECT * FROM tasks WHERE id = ?', (task_id,)
    ).fetchone()
    
    if not task:
        conn.close()
        return jsonify({'error': 'Task not found'}), 404
    
    # Delete the task
    cursor.execute('DELETE FROM tasks WHERE id = ?', (task_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Task deleted successfully'})

if __name__ == '__main__':
    # Initialize database on startup
    init_db()
    
    # Run Flask app in debug mode
    app.run(debug=True, host='0.0.0.0', port=5000)
