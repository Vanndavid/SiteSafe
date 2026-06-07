const refreshTokens = new Map<string, string>();

export const storeRefreshToken = (tokenId: string, userId: string) => {
  refreshTokens.set(tokenId, userId);
};

export const getRefreshTokenUserId = (tokenId: string) => refreshTokens.get(tokenId);

export const deleteRefreshToken = (tokenId: string) => {
  refreshTokens.delete(tokenId);
};

export const clearRefreshTokenStore = () => {
  refreshTokens.clear();
};
