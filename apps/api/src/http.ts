export const fail = (set: { status?: number }, status: number, code: string, message: string) => {
  set.status = status;
  return {
    error: {
      code,
      message,
    },
  };
};
