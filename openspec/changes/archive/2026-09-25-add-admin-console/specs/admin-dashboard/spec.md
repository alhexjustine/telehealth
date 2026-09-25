# Spec Delta

## Purpose

Gives administrators an at-a-glance operational picture computed directly from the application's
database, with no external analytics service.

## ADDED Requirements

### Requirement: Operational counts
An administrator SHALL be able to retrieve current counts computed from the database at request
time:
- patients and doctors, by account status
- doctors, by verification status
- appointments, by status: today, upcoming, and all time
- consultations currently in progress, and consultations completed today and in the last 7 days
- pending doctor reviews and invalid bookings
- for each of the last 14 days and the next 14 days, the number of booked or completed
  appointments starting that day
"Today" and daily buckets SHALL use a time zone given in the request (default `UTC`).

#### Scenario: Counts reflect the data
- **WHEN** there are 3 pending doctors and 2 invalid bookings, and an administrator requests the dashboard
- **THEN** the response reports 3 pending reviews and 2 invalid bookings

#### Scenario: Daily buckets in the admin's time zone
- **WHEN** an appointment starts at 23:30 UTC and the dashboard is requested with time zone `Asia/Manila`
- **THEN** it is counted on the following day's bucket

#### Scenario: Non-admin denied
- **WHEN** a signed-in patient or doctor requests the dashboard
- **THEN** the response is `403`

### Requirement: Dashboard page in the web app
The admin home page SHALL show:
- stat tiles for the counts
- links from the pending-review and invalid-booking tiles to the corresponding filtered pages
- a bar chart of appointments per day, covering the past and next 14 days, with today marked
It SHALL use the browser's time zone.

#### Scenario: Tile links to work queue
- **WHEN** an administrator clicks the pending reviews tile
- **THEN** the doctor review queue opens on the pending tab
