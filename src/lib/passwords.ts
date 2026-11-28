const PASSWORD_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';

export const generateStrongPassword = (length = 14): string => {
  const randomBytes = new Uint32Array(Math.max(8, length - 4));
  crypto.getRandomValues(randomBytes);
  let out = 'Mc9!';
  for (let i = 0; i < randomBytes.length; i++) {
    out += PASSWORD_CHARSET.charAt(randomBytes[i] % PASSWORD_CHARSET.length);
  }
  return out;
};
