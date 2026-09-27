# Spec Delta

## MODIFIED Requirements

### Requirement: Find a doctor page
The patient area SHALL include a "Find a doctor" page with:
- a search box that updates the results as the patient types (no separate search button), a
  specialization filter, and an availability range picker: a calendar showing one month at a time
  with arrows to move between months, limited to today and the next 13 days, where the patient
  picks a start and an end day (or a single day), plus an option to clear it for any day
- a sort selector and pagination
- doctor cards showing initials avatar, name, specializations, experience, and next available
  time in the patient's local time
- an empty state suggesting guided matching when nothing matches

#### Scenario: Filter from the page
- **WHEN** a patient selects the Dermatology filter on the Find a doctor page
- **THEN** the list shows only dermatologists and the URL reflects the filter so the view can be shared or reloaded

#### Scenario: Search as you type
- **WHEN** a patient types a doctor's name into the search box and pauses
- **THEN** the list updates to matching doctors without pressing a button, and the URL reflects the search

#### Scenario: Pick an availability range
- **WHEN** a patient picks a start and an end day in the availability calendar and applies it
- **THEN** only doctors with at least one available slot between the start of the first day and the end of the last day, in the patient's time zone, are listed, and the URL reflects the range

#### Scenario: No results
- **WHEN** a search on the page returns no doctors
- **THEN** an empty state is shown with a link to guided matching
