# DemoFlow CRM

Build a premium, production-ready Website Demo Appointment CRM for a professional call centre using Lovable, Supabase and Netlify.



User roles



1. Admin: full system access, staff management, all clients, appointments, reports and settings.

2. Booking Agent: create appointments, manage own bookings and view personal performance.

3. Demo Staff: view ALL clients and ALL appointments, access website and meeting links, update demo status, add remarks, schedule follow-ups and record sales. Only Admin can manage user roles and staff accounts.



Core features



- Secure Supabase Auth with role-based access and database-enforced RLS.

- Business/client profiles: business name, owner name, phone, email, country and IANA time zone.

- Appointment booking: date, local time, duration, time zone, Zoom/Google Meet, meeting URL, demo website URL, assigned demo staff and booking agent.

- Convert local appointment time to UTC correctly and display it in the selected time zone.

- Appointment calendar, search, filters, upcoming demos, historical appointments, rescheduling and cancellation.

- Separate appointment statuses from client results.

- Demo outcomes: Interested, Follow-up Required, Not Interested, Sold and Lost.

- Post-demo remarks, requested website changes, objections, follow-up date, final website URL and optional sale amount.

- Preserve appointment history and audit logs; never silently overwrite old remarks.

- In-app notifications for new bookings, assignments, upcoming demos and overdue follow-ups.

- Admin dashboard with real database statistics, agent performance, demo staff performance, conversion rates and date-filtered reports.

- Responsive premium UI with navy sidebar, clean white content, modern tables, useful empty states, loading states, validation and error handling.

- Functional pages: Login, Dashboard, Appointments, New Appointment, Appointment Details, Calendar, Clients, Client Details, Follow-ups, Reports, Staff and Settings.

- Add demo-data seeding only as a clearly labelled development option; never mix fake statistics into production reports.

- Use migrations or Supabase SQL for the schema, foreign keys, constraints, indexes and RLS policies.

- Never expose service-role keys or bypass authorization in frontend code.

- Use environment variables for deployment and make the project compatible with Netlify.

- Connect every form and dashboard to actual Supabase data. Do not leave buttons, forms or charts as non-functional mockups.

Implement in phases, preserve existing working code, verify each feature and report any configuration that requires manual setup. Do not claim production readiness until authentication, RLS, CRUD operations, time-zone handling and role permissions have been tested.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9bd9b4a2-6ec3-421a-9138-79538af07569).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
