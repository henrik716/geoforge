import { useState, useEffect, useCallback } from 'react';
import {
  getToken,
  clearToken,
  getUser,
  initiateOAuth,
  getUserRepositories,
  getRepositoryBranches,
  isOAuthConfigured,
  GitHubUser,
  GitHubRepo,
  TokenResponse
} from '../utils/oauthService';

export interface GitHubAuthState {
  isAuthenticated: boolean;
  user: GitHubUser | null;
  token: TokenResponse | null;
  isLoading: boolean;
  error: string | null;
  isConfigured: boolean;
}

export interface GitHubAuthActions {
  login: () => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  getUserRepos: () => Promise<GitHubRepo[]>;
  getRepoBranches: (owner: string, repo: string) => Promise<string[]>;
  clearError: () => void;
}

export const useGitHubAuth = (): GitHubAuthState & GitHubAuthActions => {
  const [state, setState] = useState<GitHubAuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    isLoading: false,
    error: null,
    isConfigured: false
  });

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      setState(prev => ({ ...prev, isLoading: true }));
      
      try {
        const configured = isOAuthConfigured();
        const token = getToken();
        const user = getUser();
        
        setState(prev => ({
          ...prev,
          isConfigured: configured,
          isAuthenticated: !!(token && user),
          token,
          user,
          isLoading: false
        }));

      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to initialize auth',
          isLoading: false
        }));
      }
    };

    initializeAuth();
  }, []);

  // Listen for OAuth completion via storage events.
  // The oauth-callback.html page writes the token to localStorage after exchanging
  // the authorization code, which fires a storage event in this (original) tab.
  useEffect(() => {
    const storageHandler = (event: StorageEvent) => {
      if (event.key === 'github_oauth_token' && event.newValue) {
        try {
          const tokenData = JSON.parse(event.newValue);
          const userData = getUser();
          setState(prev => ({
            ...prev,
            isAuthenticated: true,
            token: tokenData,
            user: userData,
            isLoading: false,
            error: null
          }));
        } catch {
          // ignore parse errors
        }
      }
    };

    window.addEventListener('storage', storageHandler);
    return () => window.removeEventListener('storage', storageHandler);
  }, []);

  const login = useCallback(async () => {
    if (!state.isConfigured) {
      setState(prev => ({
        ...prev,
        error: 'GitHub OAuth is not configured. Please set VITE_GITHUB_CLIENT_ID and VITE_GITHUB_CLIENT_SECRET environment variables.'
      }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      await initiateOAuth();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Login failed',
        isLoading: false
      }));
    }
  }, [state.isConfigured]);

  const logout = useCallback(() => {
    clearToken();
    setState(prev => ({
      ...prev,
      isAuthenticated: false,
      user: null,
      token: null,
      error: null
    }));
  }, []);

  const refreshToken = useCallback(async () => {
    if (!state.token?.refresh_token) {
      setState(prev => ({
        ...prev,
        error: 'No refresh token available'
      }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // This would need to be implemented in oauthService
      // For now, we'll just clear the session and require re-login
      logout();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Token refresh failed',
        isLoading: false
      }));
    }
  }, [state.token, logout]);

  const getUserRepos = useCallback(async (): Promise<GitHubRepo[]> => {
    if (!state.token) {
      throw new Error('Not authenticated');
    }

    try {
      const repos = await getUserRepositories(state.token.access_token);
      return repos;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch repositories';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, [state.token]);

  const getRepoBranches = useCallback(async (owner: string, repo: string): Promise<string[]> => {
    if (!state.token) {
      throw new Error('Not authenticated');
    }

    try {
      const branches = await getRepositoryBranches(state.token.access_token, owner, repo);
      return branches;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch branches';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, [state.token]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    login,
    logout,
    refreshToken,
    getUserRepos,
    getRepoBranches,
    clearError
  };
};
