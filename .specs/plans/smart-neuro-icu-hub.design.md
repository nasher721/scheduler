# Smart Neuro ICU Hub Design Spec

## Overview
Integration of an AI Copilot, Real-Time Broadcasts, and a Provider Marketplace to create an autonomous scheduling ecosystem for Neurointensivists. The system identifies gaps, evaluates constraints (fatigue, availability), automatically broadcasts targeted coverage requests, and allows providers to claim shifts via a self-service marketplace.

## 1. System Architecture & Data Flow
*   **The Brain (AI Copilot):** Uses existing AI scaffold (`PredictiveAnalytics`, `ConstraintSolver`, `NaturalLanguageQuery`) to actively monitor the schedule and calculate optimal replacements when a gap appears.
*   **The Voice (Operations Broadcast):** A notification service layer (SMS, Email, Push) triggered by the AI Copilot to contact specific Neurointensivists.
*   **The Hands (Provider Marketplace):** A self-service portal where Neurointensivists view their schedules, post shifts, and claim open shifts.

### Unified Data Flow
1. A neurointensivist posts a shift needing coverage.
2. AI Copilot evaluates constraints (fatigue, overtime) and identifies the top 3 eligible providers.
3. Broadcast system automatically sends targeted notifications.
4. Provider accepts the shift via the Marketplace.
5. AI Copilot updates the schedule and broadcasts confirmations.

## 2. Data Model & State Management
Extensions to the existing Zustand store and JSON persistence:

*   **Enhanced Neurointensivist Profiles:**
    *   `communicationPreferences`: SMS, Email, Push.
    *   `fatigueMetrics`: `consecutiveShiftsWorked`, `hoursThisMonth`.
    *   *(Note: Subspecialties are specifically excluded to keep the model streamlined).*
*   **Shift Lifecycle State Machine:**
    *   `POSTED`: Swap requested or shift dropped.
    *   `AI_EVALUATING`: Copilot calculates safest/fairest replacements.
    *   `BROADCASTING`: System pings specific providers.
    *   `CLAIMED`: Accepted by a provider.
    *   `APPROVED`: Automatically or manually confirmed by the scheduler.
*   **Broadcast & Escalation State:**
    *   New `broadcast-history` slice to track who was messaged and when.
    *   AI Copilot monitors this for auto-escalation (e.g., if no response in 45 mins, ping next tier).

## 3. Component Architecture & User Experience
The application will provide fully responsive **Desktop** and **Mobile** views for *both* roles.

### Neurointensivist Experience (The Marketplace)
*   **My Shifts:** Clean list/calendar of upcoming shifts. Tap to "Request Swap/Coverage".
*   **Personalized Shift Board:** AI-filtered feed of open shifts matching their availability and fatigue constraints. 1-tap "Claim Shift".
*   **Push Notifications:** Deep-linked alerts for urgent needs, routing directly to the Shift Board.

### Admin Experience (Command Center)
*   **Copilot Chat Drawer:** Natural language interface for queries (e.g., *"Who can cover Dr. Smith safely tomorrow?"*).
*   **1-Click Broadcast:** Integrated with Copilot recommendations to instantly trigger the notification service.
*   **Live Escalation Tracker:** Real-time activity feed showing active broadcast statuses and countdowns to auto-escalation.
