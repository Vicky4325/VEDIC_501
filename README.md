# VEDIC_501
Sports Session Management Application
Description
The Sports Session Management Application is a platform designed to streamline the management of sports sessions for both players and administrators. Players can join, create, and cancel sessions, while admins have access to comprehensive session oversight, including the ability to generate detailed reports. Cancelled sessions include a reason, which is visible to admins for better tracking and management.

Features
Player Dashboard
View Available Sports and Sessions: Browse through available sports and upcoming sessions.

Join Sessions: Easily join sessions of interest.

Create Sessions: Create new sessions for specific sports.

Cancel Sessions: Cancel sessions with a reason, which is logged for admin review.

Admin Dashboard
View All Sports and Sessions: Access a complete list of sports and sessions.

View Cancelled Sessions: Review cancelled sessions along with the reasons provided.

Create Sports and Sessions: Add new sports or sessions to the platform.

Generate Reports: Create reports for sessions and sports popularity within a customizable time period.

Reports
Session Reports: Generate detailed reports of sessions within a specified time range.

Sports Popularity Reports: Analyze sports popularity based on the number of sessions conducted.

Installation
Clone the Repository:

bash
Copy
git clone <repository-url>
Navigate to the Project Directory:

bash
Copy
cd sports-session-management
Install Dependencies:

bash
Copy
npm install
Configuration
Create a .env File:
In the project root directory, create a .env file and add the following environment variables:

plaintext
Copy
DB_USER=<your_database_user>
DB_HOST=<your_database_host>
DB_DATABASE=<your_database_name>
DB_PASSWORD=<your_database_password>
DB_PORT=<your_database_port>
SESSION_SECRET=<your_session_secret>
Set Up the PostgreSQL Database:
Run the following SQL commands to create the required tables:

sql
Copy
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL
);

CREATE TABLE sports (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    sport_id INTEGER REFERENCES sports(id),
    team1 VARCHAR(255) NOT NULL,
    team2 VARCHAR(255) NOT NULL,
    venue VARCHAR(255) NOT NULL,
    date TIMESTAMP NOT NULL,
    creator_id INTEGER REFERENCES users(id),
    cancelled BOOLEAN DEFAULT FALSE,
    cancellation_reason TEXT
);

CREATE TABLE session_players (
    session_id INTEGER REFERENCES sessions(id),
    player_id INTEGER REFERENCES users(id),
    PRIMARY KEY (session_id, player_id)
);
Running the Application
Start the Server:

bash
Copy
node index.js
Access the Application:
Open your browser and navigate to http://localhost:3000.

Usage
Player Dashboard
Sports Section: View available sports.

Available Sessions Section: Browse and join upcoming sessions.

My Sessions Section: Manage sessions created by the player.

Create Session Section: Create new sessions.

Cancel Session: Cancel a session and provide a reason.

Admin Dashboard
Sports Section: View and manage sports.

All Sessions Section: View all sessions, including those created by players.

Cancelled Sessions Section: Review cancelled sessions and their reasons.

Create Session Section: Add new sessions.

Generate Reports: Generate session and sports popularity reports.

Reports
Configure Time Period: Set the start and end date for the report.

Sessions Report: View sessions within the specified time range.

Sports Popularity Report: Analyze sports popularity based on session data.

Troubleshooting
Check server logs for error messages.

Ensure the database is correctly configured and running.

License
This project is licensed under the MIT License.

