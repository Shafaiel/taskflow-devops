-- TaskFlow schema. Runs automatically ONLY the first time the mysql_data volume is empty.

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(30)  NOT NULL UNIQUE,
  full_name     VARCHAR(80)  NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NOT NULL,
  title       VARCHAR(120) NOT NULL,
  description TEXT,
  priority    ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  status      ENUM('pending', 'done')       NOT NULL DEFAULT 'pending',
  category    VARCHAR(40)  NOT NULL DEFAULT 'General',
  due_date    DATE         NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tasks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_tasks_user_status (user_id, status),
  INDEX idx_tasks_user_due (user_id, due_date)
);

-- Demo account -> username: demo   password: demo123
INSERT INTO users (username, full_name, password_hash) VALUES
  ('demo', 'Demo User', '$2a$10$j/Ktwi1B0tcdRtI4yxv0UOpa38v8ODhB8UDrcYiNESshgkbU2nn2K');

INSERT INTO tasks (user_id, title, description, priority, status, category, due_date) VALUES
  (1, 'Write Dockerfile for API',      'Multi-stage build, non-root user, healthcheck', 'high',   'done',    'DevOps',  CURDATE() - INTERVAL 3 DAY),
  (1, 'Create docker-compose.yml',     'nginx + api + db with named volume',            'high',   'done',    'DevOps',  CURDATE() - INTERVAL 2 DAY),
  (1, 'Configure AWS Load Balancer',   'ALB + target group + health check /api/health', 'high',   'pending', 'AWS',     CURDATE() + INTERVAL 1 DAY),
  (1, 'Set up Auto Scaling Group',     'min 2 / desired 2 / max 4',                     'medium', 'pending', 'AWS',     CURDATE() + INTERVAL 2 DAY),
  (1, 'Write Selenium test script',    'Login, create task, verify element',            'medium', 'pending', 'Testing', CURDATE() + INTERVAL 3 DAY),
  (1, 'Practice Linux permissions',    'chmod, chown, ls -l',                           'low',    'pending', 'Linux',   CURDATE() - INTERVAL 1 DAY),
  (1, 'Prepare for viva',              'Read docs/VIVA_NOTES.md',                       'high',   'pending', 'Study',   CURDATE() + INTERVAL 5 DAY);
