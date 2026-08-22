DayFlow — HR Management System

DayFlow is a simple HR Management System (HRMS) that I built to handle some of the basic things an HR team and employees need in one place.

The idea was to keep the project small, easy to understand, and easy to run without making the setup unnecessarily complicated.

It includes:

- A simple marketing/home page
- Employee and HR/Admin sign-up and sign-in
- Role-based dashboards
- Employee management
- Attendance-related functionality
- HR/Admin features
- A REST API
- A lightweight local database

The entire project can run locally on a laptop in just a few minutes.

I intentionally avoided frameworks and complicated setup wherever possible. The backend uses plain Node.js with built-in SQLite, while the frontend is made with regular HTML, CSS, and JavaScript.

---

Project Structure

dayflow-project/
├── backend/     # REST API — Node.js + built-in SQLite
└── frontend/    # Static website — HTML, CSS and JavaScript

The backend and frontend are kept separate so that the project is easier to understand, develop, and modify.

---

Requirements

Before running DayFlow, make sure the following are installed.

Node.js

The backend requires:

Node.js 22.5.0 or later

This is important because the project uses Node's built-in "node:sqlite" module.

You can check your installed version using:

node -v

If the version is below "22.5.0", update Node.js before starting the backend.

Frontend Server

The frontend is made using static HTML, CSS, and JavaScript, so there is no build process.

You just need something capable of serving the frontend files.

For example:

- Python
- "npx serve"
- VS Code Live Server
- Any other simple static file server

What you don't need

One of the goals of DayFlow was to keep the setup simple.

You don't need:

- Docker
- MySQL
- PostgreSQL
- MongoDB
- A separate database server
- "npm install"
- A frontend build tool
- A complicated deployment setup

The local SQLite database is created automatically by the backend.

---

Getting Started

1. Check Node.js

Open a terminal inside the project folder and run:

node -v

Make sure the version is "22.5.0" or newer.

For example:

v22.5.0

or a newer version.

---

2. Start the Backend

Open a terminal and move into the backend folder:

cd backend

Then start the server using:

node server.js

The exact entry file may vary depending on the current project structure, but the backend should start the REST API and create the local SQLite database automatically.

Once the server is running, keep this terminal open.

---

3. Start the Frontend

Open another terminal.

Move into the frontend folder:

cd frontend

You can use a simple static server.

For example, with Python:

python -m http.server 5500

Then open the frontend in your browser:

http://localhost:5500

If you are using VS Code, you can also use the Live Server extension.

---

How DayFlow Works

The basic flow is:

User
  ↓
Frontend
  ↓
REST API
  ↓
Node.js Backend
  ↓
SQLite Database

The frontend handles the interface and user interaction.

The backend handles:

- Authentication
- User data
- Business logic
- API requests
- Database operations

SQLite stores the application data locally.

---

Authentication

DayFlow supports authentication for different types of users.

The main roles are:

Employee

Employees can access their own HR-related information and features.

Admin / HR

Admin or HR users have additional access for managing employees and HR operations.

After signing in, the dashboard changes according to the user's role.

For example:

                    Login
                      │
              ┌───────┴───────┐
              ↓               ↓
          Employee         Admin / HR
              │               │
              ↓               ↓
      Employee Dashboard   HR Dashboard

This role-based structure prevents every user from seeing the same controls.

---

Database

DayFlow uses SQLite through Node.js.

The database is stored locally inside the project.

The backend creates the database when it is needed, so there is no separate database installation or configuration.

A typical setup looks like:

backend/
├── data/
│   └── dayflow.db
├── ...

The database file contains the application data required by DayFlow.

Because SQLite is file-based, it is particularly convenient for local development, testing, and demonstrations.

---

REST API

The backend exposes REST API endpoints that the frontend communicates with.

The general flow is:

Browser
   ↓
HTTP Request
   ↓
Node.js REST API
   ↓
Database
   ↓
HTTP Response
   ↓
Browser

This keeps the frontend separate from the database.

The frontend never needs to directly access the SQLite database.

---

Frontend

The frontend intentionally uses basic web technologies:

- HTML
- CSS
- JavaScript

There is no React, Angular, Vue, or other frontend framework required.

This keeps the project lightweight and makes it easier to understand what is happening behind the scenes.

The frontend contains the main user-facing parts of DayFlow, including:

- Home page
- Authentication pages
- Employee dashboard
- Admin/HR dashboard
- HR management interfaces

---

Backend

The backend is written using plain Node.js.

The main reason for keeping it framework-free was to avoid unnecessary dependencies and make the project easier to run.

The backend is responsible for:

- Starting the HTTP server
- Processing API requests
- Authentication
- Role-based access
- Database operations
- Returning API responses
- Handling application logic

The project uses Node's built-in modules wherever practical.

---

Running the Project in VS Code

If you're developing DayFlow using VS Code, I normally recommend opening the project folder directly:

dayflow-project

Then open two terminals.

Terminal 1 — Backend

cd backend
node server.js

Terminal 2 — Frontend

cd frontend
python -m http.server 5500

Then open:

http://localhost:5500

That's basically it.

---

Development Workflow

When making changes, I usually work in this order:

1. Start backend
        ↓
2. Start frontend
        ↓
3. Open browser
        ↓
4. Test the feature
        ↓
5. Check browser console
        ↓
6. Check backend terminal
        ↓
7. Check database/API if required

This makes it easier to identify whether a problem is coming from the frontend or backend.

---

Troubleshooting

Node.js version error

If the backend does not start and you're using an older Node.js version, check:

node -v

Upgrade Node.js to version "22.5.0" or later.

---

Frontend doesn't open

Make sure the static server is running.

For Python:

python -m http.server 5500

Then visit:

http://localhost:5500

---

API requests are failing

First check whether the backend is actually running.

For example:

cd backend
node server.js

Then check the browser's developer console for the exact API error.

Also make sure the frontend is pointing to the correct backend URL and port.

---

Database problems

The SQLite database is created locally by the backend.

If you are testing from a fresh installation, check that the backend has permission to create/write files inside its data directory.

---

Why I Built It This Way

I wanted DayFlow to demonstrate the complete flow of a small HR management application without making the project difficult to run.

The main idea was:

«Keep the architecture simple, but make the application complete enough to demonstrate a real workflow.»

Instead of depending on many external services, DayFlow keeps the core application local.

That makes it useful for:

- College projects
- Hackathon demonstrations
- Learning backend development
- Learning REST APIs
- Learning authentication
- Testing role-based systems
- Experimenting with HRMS features

---

Current Limitations

DayFlow is primarily designed for local development, evaluation, and demonstration.

It should not be treated as a production HR system without additional security and reliability work.

Some areas that would need improvement before real-world deployment include:

- Stronger authentication and session management
- Production-grade password security configuration
- HTTPS
- More detailed authorization rules
- Database backups
- Audit logging
- Input validation and sanitization
- Rate limiting
- CSRF protection where applicable
- Production database infrastructure
- Secure secret management
- Comprehensive automated testing
- Error monitoring
- Scalability improvements

So, for now, I consider DayFlow a working local HRMS project rather than a production-ready enterprise HR platform.

---

Future Improvements

There are several things that can be added later.

Some possible improvements are:

- Leave management
- Payroll management
- Employee profiles
- Attendance reports
- HR analytics
- Notifications
- Document management
- Performance tracking
- Employee search and filtering
- Exporting reports
- Better mobile responsiveness
- Advanced role and permission management
- Production database support
- Cloud deployment
- Automated testing
- AI-assisted HR features

The current architecture is intentionally kept simple so these features can be added without making the initial setup unnecessarily complicated.

---

Quick Start

If everything is already installed, the basic process is:

Backend

cd backend
node server.js

Frontend

Open another terminal:

cd frontend
python -m http.server 5500

Then open:

http://localhost:5500

---

Tech Stack

Part| Technology
Frontend| HTML, CSS, JavaScript
Backend| Node.js
API| REST
Database| SQLite
Runtime| Node.js 22.5.0+
Build Tool| None
External Database| None
Docker| Not required

---

Project Goal

DayFlow started with a simple idea: build an HR management system that is easy to run, easy to understand, and still feels like a complete application.

The project focuses on the fundamentals:

Authentication
     +
Role-based access
     +
HR management
     +
REST API
     +
Local database
     =
DayFlow

Everything is designed to run locally with as little setup as possible.

If you're evaluating or developing the project, the recommended approach is to first get the basic application running, verify authentication and the dashboards, and then work on individual features one at a time.