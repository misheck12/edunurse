export const IDENTITY_DOCUMENT_ERROR_MESSAGE =
  "Enter a valid NRC (123456/12/1) or passport number.";

const ZAMBIAN_NRC_REGEX = /^\d{6}\/\d{2}\/\d{1}$/;
const PASSPORT_NUMBER_REGEX = /^(?=.*\d)[A-Z0-9]{6,20}$/;

export function normalizeIdentityDocument(value: string) {
  const trimmedUpper = value.trim().toUpperCase();
  if (!trimmedUpper) {
    return "";
  }

  const compact = trimmedUpper.replace(/\s+/g, "");
  if (ZAMBIAN_NRC_REGEX.test(compact)) {
    return compact;
  }

  return compact.replace(/[^A-Z0-9]/g, "");
}

export function isValidIdentityDocument(value: string) {
  const normalized = normalizeIdentityDocument(value);
  return (
    ZAMBIAN_NRC_REGEX.test(normalized) ||
    PASSPORT_NUMBER_REGEX.test(normalized)
  );
}
