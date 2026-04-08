const { validateBulkCreate } = require('../../validators/questionBankValidator');

describe('questionBankValidator bulk create topic normalization', () => {
  test('normalizes array topic input into a string', () => {
    const payload = validateBulkCreate({
      provider: 'manual-publisher',
      questions: [
        {
          question: 'Who built the Taj Mahal?',
          options: ['Akbar', 'Shah Jahan', 'Aurangzeb', 'Babur'],
          answer: 'Shah Jahan',
          topic: ['history'],
        },
      ],
    });

    expect(payload.questions[0].topic).toBe('history');
  });

  test('keeps plain string topic input unchanged', () => {
    const payload = validateBulkCreate({
      provider: 'manual-publisher',
      questions: [
        {
          question: 'Who built the Taj Mahal?',
          options: ['Akbar', 'Shah Jahan', 'Aurangzeb', 'Babur'],
          answer: 'Shah Jahan',
          topic: 'history',
        },
      ],
    });

    expect(payload.questions[0].topic).toBe('history');
  });
});
