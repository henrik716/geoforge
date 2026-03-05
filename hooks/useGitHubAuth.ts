import { useState, useEffect, useCallback } from 'react';
import {
  getToken,
  storeToken,
  clearToken,
  getUser,
  storeUser,
  getGitHubUser,
  initiateOAuth,
  handleOAuthCallback,
  exchangeCodeForToken,
  exchangeCodeForTokenWithProxy,
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

        // Handle OAuth callback if we're on the callback page
        if (window.location.pathname === '/oauth/callback' && window.location.search.includes('code=')) {
          try {
            const tokenData = await handleOAuthCallback();
            storeToken(tokenData);
            
            const userData = await getGitHubUser(tokenData.access_token);
            storeUser(userData);
            
            setState(prev => ({
              ...prev,
              isAuthenticated: true,
              token: tokenData,
              user: userData,
              isLoading: false
            }));
            
            // Redirect to main app
            window.location.href = '/';
          } catch (error) {
            console.error('OAuth callback error:', error);
            setState(prev => ({
              ...prev,
              error: error instanceof Error ? error.message : 'OAuth callback failed',
              isLoading: false
            }));
          }
        }
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

  // Listen for OAuth popup messages
  useEffect(() => {
    const messageHandler = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'oauth-code') {
        // Received authorization code from popup, now exchange for token
        try {
          setState(prev => ({ ...prev, isLoading: true, error: null }));
          
          // Use a CORS proxy for the token exchange
          const tokenData = await exchangeCodeForTokenWithProxy(event.data.code);
          storeToken(tokenData);
          
          const userData = await getGitHubUser(tokenData.access_token);
          storeUser(userData);
          
          setState(prev => ({
            ...prev,
            isAuthenticated: true,
            token: tokenData,
            user: userData,
            isLoading: false,
            error: null
          }));
        } catch (error) {
          console.error('Token exchange error:', error);
          setState(prev => ({
            ...prev,
            error: error instanceof Error ? error.message : 'Failed to exchange authorization code',
            isLoading: false
          }));
        }
      } else if (event.data.type === 'oauth-success') {
        const { token, user } = event.data;
        storeToken(token);
        storeUser(user);
        
        setState(prev => ({
          ...prev,
          isAuthenticated: true,
          token,
          user,
          isLoading: false,
          error: null
        }));
      } else if (event.data.type === 'oauth-error') {
        setState(prev => ({
          ...prev,
          error: event.data.error,
          isLoading: false
        }));
      }
    };
    
    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
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
