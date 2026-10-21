-- Original design schema for the School Management Software (MySQL), kept for the project report.
-- The live tables are created by the migrations in server/migrations/ and must match the
-- Sequelize models in server/src/models/index.js (they add terms.resultsPublished, observations, etc.).

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'teacher', 'bursar', 'parent') NOT NULL,
  phone VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(20) NOT NULL UNIQUE,          -- e.g. 2026/2027
  is_current BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE terms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  name VARCHAR(20) NOT NULL,                 -- First, Second, Third
  start_date DATE,
  end_date DATE,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE classes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,                 -- e.g. Nursery 1, Primary 3
  arm VARCHAR(10),                           -- e.g. A, B
  class_teacher_id INT,
  FOREIGN KEY (class_teacher_id) REFERENCES users(id)
);

CREATE TABLE subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE class_subjects (
  class_id INT NOT NULL,
  subject_id INT NOT NULL,
  teacher_id INT,
  PRIMARY KEY (class_id, subject_id),
  FOREIGN KEY (class_id) REFERENCES classes(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (teacher_id) REFERENCES users(id)
);

CREATE TABLE students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admission_no VARCHAR(30) NOT NULL UNIQUE,
  first_name VARCHAR(60) NOT NULL,
  last_name VARCHAR(60) NOT NULL,
  gender ENUM('male', 'female') NOT NULL,
  date_of_birth DATE,
  class_id INT,
  admission_date DATE,
  status ENUM('active', 'graduated', 'withdrawn') NOT NULL DEFAULT 'active',
  FOREIGN KEY (class_id) REFERENCES classes(id)
);

CREATE TABLE student_parents (
  student_id INT NOT NULL,
  parent_id INT NOT NULL,
  relationship VARCHAR(30),
  PRIMARY KEY (student_id, parent_id),
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (parent_id) REFERENCES users(id)
);

CREATE TABLE attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  date DATE NOT NULL,
  status ENUM('present', 'absent', 'late', 'excused') NOT NULL,
  recorded_by INT,
  UNIQUE (student_id, date),
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (recorded_by) REFERENCES users(id)
);

CREATE TABLE scores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  subject_id INT NOT NULL,
  term_id INT NOT NULL,
  ca_score DECIMAL(5,2) DEFAULT 0,
  exam_score DECIMAL(5,2) DEFAULT 0,
  teacher_remark VARCHAR(255),
  UNIQUE (student_id, subject_id, term_id),
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (term_id) REFERENCES terms(id)
);

CREATE TABLE fee_structures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  class_id INT NOT NULL,
  term_id INT NOT NULL,
  description VARCHAR(100) NOT NULL,         -- e.g. Tuition, Uniform
  amount DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (class_id) REFERENCES classes(id),
  FOREIGN KEY (term_id) REFERENCES terms(id)
);

CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  term_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  method ENUM('cash', 'transfer', 'pos') NOT NULL,
  receipt_no VARCHAR(30) NOT NULL UNIQUE,
  paid_on DATE NOT NULL,
  recorded_by INT,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (term_id) REFERENCES terms(id),
  FOREIGN KEY (recorded_by) REFERENCES users(id)
);

CREATE TABLE announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  body TEXT NOT NULL,
  audience ENUM('all', 'teachers', 'parents') NOT NULL DEFAULT 'all',
  posted_by INT,
  posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (posted_by) REFERENCES users(id)
);

CREATE TABLE audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
