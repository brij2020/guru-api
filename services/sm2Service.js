const UserTopicPerformance = require('../models/userTopicPerformance');

class SM2Service {
  constructor() {
    this.MIN_EASE_FACTOR = 1.3;
    this.DEFAULT_EASE_FACTOR = 2.5;
  }

  getWeekKey(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split('T')[0];
  }

  addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  mapQuality(isCorrect, confidence = 'medium') {
    if (!isCorrect) {
      return 1;
    }
    switch (confidence) {
      case 'low': return 3;
      case 'medium': return 4;
      case 'high': return 5;
      default: return 4;
    }
  }

  calculateNextReview(quality, currentEaseFactor, currentInterval, currentRepetitions) {
    let easeFactor = currentEaseFactor || this.DEFAULT_EASE_FACTOR;
    let interval = currentInterval || 1;
    let repetitions = currentRepetitions || 0;

    if (quality < 3) {
      repetitions = 0;
      interval = 1;
    } else {
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetitions += 1;
    }

    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (easeFactor < this.MIN_EASE_FACTOR) {
      easeFactor = this.MIN_EASE_FACTOR;
    }

    const nextReviewAt = this.addDays(new Date(), interval);

    return {
      easeFactor: Math.round(easeFactor * 100) / 100,
      interval,
      repetitions,
      nextReviewAt
    };
  }

  async updateTopicPerformance(userId, topic, isCorrect, confidence = 'medium') {
    const quality = this.mapQuality(isCorrect, confidence);
    const weekKey = this.getWeekKey();

    let performance = await UserTopicPerformance.findOne({ userId, topic });

    if (!performance) {
      performance = new UserTopicPerformance({
        userId,
        topic,
        totalAttempts: 0,
        correctAnswers: 0,
        totalTimeSeconds: 0,
        weeklyAccuracy: []
      });
    }

    performance.totalAttempts += 1;
    if (isCorrect) {
      performance.correctAnswers += 1;
    }

    performance.accuracy = performance.calculateAccuracy();

    const sm2Result = this.calculateNextReview(
      quality,
      performance.easeFactor,
      performance.interval,
      performance.repetitions
    );

    performance.easeFactor = sm2Result.easeFactor;
    performance.interval = sm2Result.interval;
    performance.repetitions = sm2Result.repetitions;
    performance.nextReviewAt = sm2Result.nextReviewAt;
    performance.lastAttemptedAt = new Date();

    let weekData = performance.weeklyAccuracy.find(w => w.week === weekKey);
    if (!weekData) {
      performance.weeklyAccuracy.push({ week: weekKey, accuracy: 0, attempts: 0 });
      weekData = performance.weeklyAccuracy[performance.weeklyAccuracy.length - 1];
    }
    weekData.attempts += 1;
    if (isCorrect) weekData.accuracy = Math.round((weekData.accuracy * (weekData.attempts - 1) + 100) / weekData.attempts);
    else weekData.accuracy = Math.round((weekData.accuracy * (weekData.attempts - 1)) / weekData.attempts);

    if (performance.weeklyAccuracy.length > 8) {
      performance.weeklyAccuracy = performance.weeklyAccuracy.slice(-8);
    }

    const trendResult = performance.calculateTrend();
    performance.trend = trendResult.trend;
    performance.trendDelta = trendResult.trendDelta;

    await performance.save();

    return {
      nextReviewAt: performance.nextReviewAt,
      easeFactor: performance.easeFactor,
      interval: performance.interval,
      repetitions: performance.repetitions,
      accuracy: performance.accuracy,
      trend: performance.trend,
      trendDelta: performance.trendDelta
    };
  }

  async addWrongQuestion(userId, topic, questionId) {
    const performance = await UserTopicPerformance.findOne({ userId, topic });
    if (!performance) return null;

    if (!performance.wrongQuestionIds.includes(questionId)) {
      performance.wrongQuestionIds.push(questionId);
      performance.nextReviewAt = this.addDays(new Date(), 1);
      performance.repetitions = 0;
      performance.interval = 1;
      await performance.save();
    }

    return performance;
  }

  async removeWrongQuestion(userId, topic, questionId) {
    const performance = await UserTopicPerformance.findOne({ userId, topic });
    if (!performance) return null;

    performance.wrongQuestionIds = performance.wrongQuestionIds.filter(id => id !== questionId);
    await performance.save();

    return performance;
  }

  async getDueForReview(userId) {
    const now = new Date();
    return UserTopicPerformance.find({
      userId,
      nextReviewAt: { $lte: now },
      totalAttempts: { $gt: 0 }
    }).sort({ nextReviewAt: 1 });
  }

  async getTopicPerformance(userId) {
    return UserTopicPerformance.find({ userId, totalAttempts: { $gt: 0 } })
      .sort({ accuracy: 1 });
  }
}

module.exports = new SM2Service();
