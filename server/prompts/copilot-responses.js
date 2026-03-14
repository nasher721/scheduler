/**
 * Copilot per-intent responses (message, suggestions, actions).
 * Edit this file to change copilot copy without touching orchestration logic.
 * Placeholders: message/suggestions can use entity keys; actions are built with entities/context.
 */

function buildResponses(entities = {}, context = {}) {
  return {
    greeting: {
      message: "Hello! I'm your scheduling assistant. How can I help you today? You can ask me to:\n• Request time off\n• Check coverage\n• Optimize the schedule\n• Find conflicts\n• Or just tell me what you need!",
      suggestions: ['Show my schedule', 'Who covers next weekend?', 'Optimize schedule'],
      requiresConfirmation: false,
    },

    request_time_off: {
      message: entities.date
        ? `I'll help you request time off for ${entities.date}. Let me check coverage first.`
        : "I'd be happy to help you request time off. What date(s) do you need?",
      suggestions: entities.date ? ['Check coverage', 'Submit request', 'Find alternative'] : ['Next Monday', 'Next week', 'March 15-17'],
      requiresConfirmation: false,
      actions: entities.date ? [{ type: 'check_coverage', date: entities.date }] : [],
    },

    request_swap: {
      message: entities.targetProvider
        ? `I can help you swap shifts with ${entities.targetProvider}. Which shift would you like to swap?`
        : "I can help you arrange a shift swap. Which shift do you want to swap and with whom?",
      suggestions: ['My next night shift', 'This weekend', 'Let me pick from calendar'],
      requiresConfirmation: false,
    },

    optimize_schedule: {
      message: "I'll analyze the current schedule and suggest optimizations for better fairness and coverage. You can use quick auto-fill or run the full AI multi-agent optimizer.",
      suggestions: ['Optimize now', 'Show me conflicts first', 'Run full AI optimizer', 'Adjust optimization goals'],
      requiresConfirmation: true,
      preview: { type: 'optimization', estimatedImpact: 'Calculating...' },
      actions: [{ type: "auto_assign" }, { type: "multi_agent_optimize" }],
    },

    check_coverage: {
      message: entities.date
        ? `Let me check coverage for ${entities.date}${entities.shiftType ? ` (${entities.shiftType})` : ''}.`
        : "Which date or time period would you like me to check coverage for?",
      suggestions: ['This weekend', 'Next week', 'Tonight', 'All uncovered shifts'],
      requiresConfirmation: false,
      actions: [{ type: 'show_coverage', date: entities.date, shiftType: entities.shiftType }],
    },

    explain_assignment: {
      message: "I'll explain the reasoning behind your assignments. Looking at your targets, preferences, and fairness across the team...",
      suggestions: ['Why so many nights?', 'Why this weekend?', 'Show my fairness score'],
      requiresConfirmation: false,
      actions: [{ type: 'explain_assignments', providerId: context?.currentUser?.id }],
    },

    simulate_scenario: {
      message: "I can simulate what would happen in that scenario. This helps us prepare contingency plans.",
      suggestions: ['Dr. Smith sick', 'Census surge 20%', 'Multiple absences'],
      requiresConfirmation: false,
      preview: { type: 'simulation', scenario: 'absence' },
    },

    get_recommendations: {
      message: "Here are my recommendations based on the current schedule:",
      suggestions: ['Show all recommendations', 'Focus on fairness', 'Focus on coverage'],
      requiresConfirmation: false,
    },

    show_conflicts: {
      message: "I'll scan the schedule for conflicts, double-bookings, and constraint violations.",
      suggestions: ['Show all conflicts', 'Show critical only', 'Auto-fix where possible'],
      requiresConfirmation: false,
      actions: [{ type: 'detect_conflicts' }],
    },

    resolve_conflicts: {
      message: "I can auto-resolve conflicts that support safe auto-fixes and leave the rest for manual review.",
      suggestions: ['Run auto-fix now', 'Show unresolved only', 'Rescan conflicts'],
      requiresConfirmation: false,
      actions: [{ type: "detect_conflicts" }, { type: "resolve_conflicts" }],
    },

    assign_shift: {
      message: entities.date
        ? `I can assign a shift${entities.shiftType ? ` (${entities.shiftType})` : ""} on ${entities.date}.`
        : "I can assign a shift. Tell me the date (and optional shift type).",
      suggestions: ['Assign selected date', 'Assign night shift', 'Assign day shift'],
      requiresConfirmation: false,
      actions: [{ type: "assign_shift", date: entities.date, shiftType: entities.shiftType, providerName: entities.targetProvider || entities.providerName }],
    },

    adjust_parameters: {
      message: "I can update calendar and scheduling filters based on your request.",
      suggestions: ["Show conflicts only", "Show unfilled only", "Switch to month view", "Reset filters"],
      requiresConfirmation: false,
      actions: [{
        type: "adjust_parameters",
        date: entities.date,
        shiftType: entities.shiftType,
        surfaceView: entities.surfaceView,
        showConflictsOnly: entities.showConflictsOnly,
        showUnfilledOnly: entities.showUnfilledOnly,
      }],
    },

    unassign_shift: {
      message: entities.date
        ? `I can clear the assignment${entities.shiftType ? ` for ${entities.shiftType}` : ""} on ${entities.date}.`
        : "I can remove a shift assignment. Tell me the date (and optional shift type).",
      suggestions: ['Clear selected date', 'Clear night shift', 'Clear day shift'],
      requiresConfirmation: false,
      actions: [{ type: "unassign_shift", date: entities.date, shiftType: entities.shiftType }],
    },

    save_scenario: {
      message: entities.scenarioName
        ? `Saving scenario "${entities.scenarioName}".`
        : "I can save the current plan as a scenario snapshot.",
      suggestions: ['Save scenario as Weekend Plan', 'Save scenario as Backup Roster'],
      requiresConfirmation: false,
      actions: [{ type: "save_scenario", scenarioName: entities.scenarioName }],
    },

    load_scenario: {
      message: entities.scenarioName
        ? `I can load scenario "${entities.scenarioName}".`
        : "I can load a saved scenario. Tell me which one.",
      suggestions: ['Load latest scenario', 'Load Weekend Plan'],
      requiresConfirmation: false,
      actions: [{ type: "load_scenario", scenarioName: entities.scenarioName }],
    },

    delete_scenario: {
      message: entities.scenarioName
        ? `I can delete scenario "${entities.scenarioName}".`
        : "I can delete a saved scenario. Tell me which one.",
      suggestions: ['Delete latest scenario', 'Delete Weekend Plan'],
      requiresConfirmation: false,
      actions: [{ type: "delete_scenario", scenarioName: entities.scenarioName }],
    },

    adjust_preferences: {
      message: "I can help you update your scheduling preferences. What would you like to change?",
      suggestions: ['Fewer weekends', 'Fewer nights', 'More day shifts', 'Specific dates off'],
      requiresConfirmation: false,
    },

    unknown: {
      message: "I'm not sure I understood. I can help you with:\n• Requesting time off or swaps\n• Checking coverage\n• Optimizing the schedule\n• Explaining assignments\n• Finding conflicts\n\nWhat would you like to do?",
      suggestions: ['Request time off', 'Check coverage', 'Optimize schedule', 'Show help'],
      requiresConfirmation: false,
    },
  };
}

export { buildResponses };
