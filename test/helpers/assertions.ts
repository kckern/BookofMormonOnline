export const expectNoErrors = (result: { errors?: unknown[] }) => {
  expect(result.errors).toBeUndefined();
};

export const expectSuccess = (
  result: { data?: Record<string, { isSuccess: boolean }> },
  field: string
) => {
  expect(result.data?.[field]?.isSuccess).toBe(true);
};

export const expectArrayWithItems = (arr: unknown[] | undefined) => {
  expect(arr).toBeDefined();
  expect(Array.isArray(arr)).toBe(true);
  expect(arr!.length).toBeGreaterThan(0);
};

export const expectDefined = (value: unknown, ...fields: string[]) => {
  expect(value).toBeDefined();
  fields.forEach(field => {
    expect(value).toHaveProperty(field);
  });
};
