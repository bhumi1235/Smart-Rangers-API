CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  otp_hash VARCHAR(255),
  otp_expiry TIMESTAMP,
  otp_attempts INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS duty_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS guards (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  profile_photo VARCHAR(255),
  phone VARCHAR(20) UNIQUE,
  email VARCHAR(255),
  current_address TEXT,
  permanent_address TEXT,
  emergency_address TEXT,
  duty_type_id INTEGER REFERENCES duty_types(id),
  duty_start_time VARCHAR(20),
  duty_end_time VARCHAR(20),
  working_location VARCHAR(255),
  work_experience VARCHAR(255),
  reference_by VARCHAR(255),
  supervisor_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  local_guard_id INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS emergency_contacts (
  id SERIAL PRIMARY KEY,
  guard_id INTEGER REFERENCES guards(id) ON DELETE CASCADE,
  name VARCHAR(255),
  phone VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  guard_id INTEGER REFERENCES guards(id) ON DELETE CASCADE,
  file_path VARCHAR(255),
  original_name VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50),
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  supervisor_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  local_notification_id INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  profile_photo VARCHAR(255),
  phone VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255),
  password_hash VARCHAR(255) NOT NULL,
  otp_hash VARCHAR(255),
  otp_expiry TIMESTAMP,
  player_id VARCHAR(255),
  device_type VARCHAR(50),
  role VARCHAR(20) DEFAULT 'supervisor',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
