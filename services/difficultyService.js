const getDifficultyLevels = async () => {
  return [
    {
      key: 'all',
      label: 'All Levels',
      description: 'Mix of all difficulty levels',
      color: '#e0f2fe',
      order: 1,
    },
    {
      key: 'easy',
      label: 'Easy',
      description: 'Beginner friendly questions',
      color: '#dcfce7',
      order: 2,
    },
    {
      key: 'medium',
      label: 'Medium',
      description: 'Balanced mix of challenges',
      color: '#ffedd5',
      order: 3,
    },
    {
      key: 'hard',
      label: 'Hard',
      description: 'Advanced level challenges',
      color: '#fee2e2',
      order: 4,
    },
  ];
};

module.exports = {
  getDifficultyLevels,
};
