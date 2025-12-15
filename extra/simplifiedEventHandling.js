function handleEvent(eventType, userId, metadata) {
  const journey = findActiveJourney(userId);
  const task = journey?.findTaskByEvent(eventType);
  if (!journey || !task) return;
  markTaskCompleted({
    userId,
    journeyId: journey.id,
    taskId: task.id,
    metadata,
  });
  const progress = calculateProgress(userId, journey.id);
  if (progress.isCompleted) {
    showToast("success", "Onboarding gennemført.");
  } else {
    showToast(
      "info",
      `${progress.completed} af ${progress.total} onboarding-trin gennemført.`
    );
  }
  updateAdminDashboard(userId, journey.id, progress);
}
