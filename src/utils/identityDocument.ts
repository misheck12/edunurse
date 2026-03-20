export const identityDocumentErrorMessage =
  "Enter a valid NRC (123456/12/1) or passport number.";

const zambianNrcRegex = /^\d{6}\/\d{2}\/\d{1}$/;
const passportNumberRegex = /^(?=.*\d)[A-Z0-9]{6,20}$/;

export function normalizeIdentityDocument(value: string) {
  const trimmedUpper = value.trim().toUpperCase();
  if (!trimmedUpper) {
    return "";
  }

  const compact = trimmedUpper.replace(/\s+/g, "");
  if (zambianNrcRegex.test(compact)) {
    return compact;
  }

  return compact.replace(/[^A-Z0-9]/g, "");
}

export function isValidIdentityDocument(value: string) {
  const normalized = normalizeIdentityDocument(value);
  return (
    zambianNrcRegex.test(normalized) ||
    passportNumberRegex.test(normalized)
  );
}
