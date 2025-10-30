# Conductor Application Design Documentation 

## Description 

The Conductor Application is a tool designed to manage and operate large-scale software engineering courses at UCSD. The primary goal is to automate time-consuming administrative tasks and create fair evaluations for each student and team. 

Key capabilities include user management with role-based access, attendance tracking, work journaling, automated task management, and analytics-driven insights for course optimization. The system emphasizes accessibility, internationalization, and mobile-friendly design to support diverse student populations in current educational environments. 

## Functional Requirements 

### User Management System
- **[FR.1]** User manager must support multiple role levels:
  - Instructor
  - Teaching Assistant
  - Tutor
  - Student Leader
  - Standard Student

### Class Directory & Reporting
- **[FR.2]** Class directory feature must provide read/reporting capabilities with role-based access and understanding levels

### Attendance System
- **[FR.3]** Quick entry system requirements:
  - Show attendance via phone interface within 1 minute
  - Allow updates for both lectures and arbitrary meetings
  - Provide team-based overview with percentage tracking
  - Display attendance trends over time

### Work Journal & Stand-up Tool
- **[FR.4]** Work journal and stand-up tool must enable users to:
  - Document completed work and express sentiment
  - Reach out to team leaders, TAs, or professors easily
  - Integrate with GitHub repositories
  - Support automated notifications via email or chat
  - Reference: StatusHero for implementation patterns

### Group Management
- **[FR.5]** Must provide functionality to create and assign groups within classes

### Automated Task Management
- **[FR.6]** Must automate time-consuming administrative tasks for teaching staff

### Observation Capture System
- **[FR.7]** Must provide structured system to capture observations for fair student and group evaluation

### Insights and Analytics
- **[FR.8]** Must provide insights and analytics to help large-scale software engineering classes run more smoothly

### Student and Group Evaluation
- **[FR.9]** Must provide tools for fair assessment of students and groups

## Non-Functional Requirements

### Accessibility & Inclusivity
- **[NFR.1]** Application must be accessibility (a11y) friendly, especially considering OSD students, and follow traditional web application patterns
  - **[NFR.1.1]** Must be color-blind friendly with sufficient contrast ratios
  - **[NFR.1.2]** Must support screen readers and keyboard navigation
  - **[NFR.1.3]** Must include ARIA labels and semantic HTML structure

### Internationalization
- **[NFR.2]** Application must be internationalizable for ESL students who auto-translate English into their native language
  - **[NFR.2.1]** Must support UTF-8 character encoding and responsive design
  - **[NFR.2.2]** Must use clear, simple language and avoid idioms

### Technical Architecture
- **[NFR.3]** Application must be written using core platform technologies for long-term support including standard HTML, CSS, Vanilla JavaScript, and web components

### Performance & Scalability
- **[NFR.4]** Must handle 500-1000 simultaneous sessions and scale beyond that point. Scalability limitations beyond this threshold should be hardware-related, not software-related
- **[NFR.5]** System response time must be under 2 seconds for standard operations
- **[NFR.6]** Must maintain 99% uptime during academic hours
- **[NFR.7]** Must support concurrent user sessions without performance degradation

### Security & Data Protection
- **[NFR.8]** Must implement appropriate security measures given the educational nature of the project
  - **[NFR.8.1]** Must integrate with UCSD OAuth for authentication
  - **[NFR.8.2]** Must use database encryption for all stored data
  - **[NFR.8.3]** Must implement AWS IAM roles for access control
  - **[NFR.8.4]** Must ensure mobile-friendly security protocols
- **[NFR.9]** Must ensure data persistence and backup capabilities
- **[NFR.10]** Must comply with FERPA requirements for student data protection

### Platform Support
- **[NFR.11]** Must be mobile and web-friendly with responsive design

### Development Practices
- **[NFR.12]** Should incorporate research-based development practices and explore collaborative working methodologies

### Large-Scale Class Support
- **[NFR.13]** Must handle large-scale software engineering classes efficiently

### Evaluation Fairness
- **[NFR.14]** System must ensure unbiased assessment capabilities

### Teaching Staff Efficiency
- **[NFR.15]** Must demonstrably reduce administrative overhead for teaching staff

## Main Components 

### Authentication & Authorization Module
- UCSD OAuth integration for secure login
- Role-based access control (Instructor, TA, Tutor, Student Leader, Student)
- AWS IAM integration for resource management

### User Management System
- Multi-role user profiles and permissions
- Class roster management and enrollment
- Contact information and communication preferences

### Attendance Tracking System
- Mobile-optimized quick entry interface
- Real-time attendance capture for lectures and meetings
- Automated attendance analytics and trend reporting
- Integration with calendar systems

### Work Journal & Stand-up Tool
- Daily/weekly work logging interface
- Sentiment tracking and team communication
- GitHub repository integration for automatic commit tracking
- Automated notifications and reminders

### Group Management Module
- Dynamic group creation and assignment
- Group performance tracking and analytics
- Collaborative workspace management

### Observation & Evaluation System
- Structured observation capture templates
- Fair evaluation rubrics and scoring
- Progress tracking and milestone management
- Automated report generation

### Analytics & Insights Dashboard
- Real-time class performance metrics
- Attendance patterns and engagement analysis
- Individual and group progress visualization
- Teaching staff efficiency reports

### Administrative Automation
- Automated task scheduling and reminders
- Bulk operations for common administrative tasks
- Integration with external educational platforms
- Backup and data management utilities 

## Implementation Planning Phase (Milestones)

### Sprint 1 (Nov 3-16, 2024): [insert here]

### Sprint 2 (Nov 17-30, 2024): [insert here]

### Sprint 3 (Dec 1-7, 2024): [insert here]

## Architecture & Design Decisions 

### Technology Stack
- **Frontend**: Vanilla JavaScript, HTML5, CSS3, Web Components
- **Backend**: Node.js with Express.js framework
- **Authentication**: UCSD OAuth 2.0 integration
- **CI/CD**: GitHub Actions with automated testing and deployment

FINISH 

## Quality Assurance 

FINISH 