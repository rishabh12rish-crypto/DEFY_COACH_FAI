# DEFY | Athletic Performance & Nutrition Hub

DEFY is a full-stack athletic coaching and sports nutrition web application with persistent JSON memory, editable user bio-metrics/intakes, and a multi-scenario conversational AI coach.

## Key Features

- **Editable Athlete Dashboard:** Edit bodyweight, height, body fat %, daily calorie intake, macro targets (protein, carbs, fats), water intake, active workout split, and preferred food staples. Every update is persisted to `.json` storage and immediately fed into the AI chatbot.
- **Persistent Cross-Conversation JSON History:** All user metrics, profile edit logs, extracted memories, and chat sessions are automatically stored in `backend/data/*.json` (`history.json`, `user_profile.json`, `conversations.json`) and injected into the AI's context across every conversation.
- **Multi-Scenario Conversational AI Coach:**
  - **Casual Conversation:** Handles normal greetings, small talk, and check-ins naturally without dumping tables.
  - **Motivation & Busy-Day Adjustments:** Provides empathetic minimum-effective-dose 20-minute workouts or recovery options when tired or pressed for time.
  - **Dynamic Food Planning Guide:** Generates full-day meal plans mathematically scaled to the user's live edited calorie and macro targets.
  - **Activity & Workout Planning:** Designs hypertrophy splits, 5K/running programs, outdoor conditioning, and 15-minute HIIT finishers.
  - **Injury & Mobility Troubleshooting:** Prescribes phased decompression and core stabilization routines.

## Project Structure

```text
.
├── .env.example              # Safe environment variable template
├── .gitignore                # Excludes .env secrets & private runtime .json data
├── package.json              # Scripts for start, dev, and automated tests
├── backend/
│   ├── server.js             # Zero-dependency Node.js HTTP & REST API server
│   ├── aiEngine.js           # Scenario-trained AI dispatch engine
│   ├── historyStore.js       # Persistent JSON storage & cross-session memory builder
│   └── data/                 # Auto-generated JSON storage directory (git-ignored)
├── frontend/
│   ├── index.html            # Athlete dashboard + corner pop-up chatbot UI
│   ├── styles.css            # Sporty Coral-Orange & Mint-Teal design system
│   └── app.js                # Frontend state, profile editor modal, and chat client
└── tests/
    └── run_tests.js          # End-to-end automated scenario & JSON storage test suite
```

## Getting Started

1. **Configure Environment Variables:**
   ```bash
   cp .env.example .env
   ```
   Open `.env` and set your `AI_API_KEY`. *(If left blank or offline, the server automatically runs using its built-in scenario-trained coaching engine).*

2. **Start the Server:**
   ```bash
   npm start
   ```
   Open `http://localhost:3000` in your browser.

3. **Run the Automated Test Suite:**
   ```bash
   npm test
   ```
