export default {
  test: {
    environment: 'node',
    globals: true,
    pool: 'threads',
    include: ['tests/**/*.test.ts'],
  },
};
