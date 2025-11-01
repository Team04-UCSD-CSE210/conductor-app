# Conductor Application Design Documentation

## Description

The Conductor App is a tool designed to manage large-scale software
engineering undergraduate courses at UCSD.

Key capabilities include user management with role-based access, attendance
tracking, work journaling, automated task management, and analytics for course
optimization. The system emphasizes accessibility, internationalization, and
mobile-friendly design to support each student in current educational
environments.

## Requirements

### Functional Requirements

The conductor application must...

- **[FR.1]** Support multiple user role levels including:
  - Instructor
  - Teaching Assistant
  - Tutor
  - Student Leader
  - Standard Student

- **[FR.2]** Contain a class directory feature with read & reporting
  capabilities on role-based access and understanding levels

- **[FR.3]** Integrate an attendance system that:
  - **[FR.3.1]** Shows attendance via phone interface within 1 minute
  - **[FR.3.2]** Allows updates for both lectures and arbitrary meetings
  - **[FR.3.3]** Provides team-based overview with percentage tracking
  - **[FR.3.4]** Displays attendance trends over time

- **[FR.4]** Displays a work journal and stand-up tool for users to:
  - **[FR.4.1]** Document completed work and express sentiment
  - **[FR.4.2]** Reach out to team leaders, TAs, or professors easily
  - **[FR.4.3]** Integrate with GitHub repositories
  - **[FR.4.4]** Support automated notifications via email or chat
  - **[FR.4.5]** Reference: StatusHero for implementation patterns

- **[FR.5]** Provide functionality to create and assign groups within
  classes

- **[FR.6]** Automate time-consuming administrative tasks for teaching
  staff

- **[FR.7]** Provide structured system to capture observations for fair
  student and group evaluation
  - **[FR.7.1]** Showcase interactions, pulses, alerts, activity, and reporting

- **[FR.8]** Showcase insights and analytics to help large-scale software
  engineering classes run more smoothly

- **[FR.9]** Ensure tools are integrated for fair assessment of students
  and groups

### Non-Functional Requirements

The conductor application must be...

- **[NFR.1]** Accessibility (a11y) friendly, especially considering OSD
  students, and follow traditional web application patterns
  - **[NFR.1.1]** Color-blind friendly with sufficient contrast ratios
  - **[NFR.1.2]** Support screen readers and keyboard navigation
  - **[NFR.1.3]** Include ARIA labels and semantic HTML structure

- **[NFR.2]** Internationalizable for ESL students who auto-translate
  English into their native language
  - **[NFR.2.1]** Support UTF-8 character encoding and responsive design
  - **[NFR.2.2]** Use clear, simple language and avoid idioms

- **[NFR.3]** Application must be written using core platform technologies
  for long-term support including standard HTML, CSS, Vanilla JavaScript,
  and web components

- **[NFR.4]** Handle 500-1000 simultaneous sessions and scale beyond that
  point. Scalability limitations beyond this threshold should be
  hardware-related, not software-related
- **[NFR.5]** System response time must be under 2 seconds for standard
  operations
- **[NFR.6]** Maintain 99% uptime during academic hours
- **[NFR.7]** Support concurrent user sessions without performance
  degradation

- **[NFR.8]** Implement appropriate security measures given the educational
  nature of the project
  - **[NFR.8.1]** Integrate with UCSD OAuth for authentication
  - **[NFR.8.2]** Use database encryption for all stored data
  - **[NFR.8.3]** Implement AWS IAM roles for access control
  - **[NFR.8.4]** Ensure mobile-friendly security protocols
- **[NFR.9]** Ensure data persistence and backup capabilities
- **[NFR.10]** Comply with FERPA requirements for student data protection

- **[NFR.11]** Be mobile and web-friendly with responsive design

- **[NFR.12]** Incorporate research-based development practices and explore
  collaborative working methodologies

- **[NFR.13]** Handle large-scale software engineering classes efficiently

- **[NFR.14]** Ensure unbiased assessment capabilities

- **[NFR.15]** Reduce administrative overhead for teaching staff

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

- Sprint 1 (Nov 3-16, 2025)
- Sprint 2 (Nov 17-30, 2025)
- Sprint 3 (Dec 1-7, 2025)
