import { useState, useEffect } from 'react';
import { getApiKey, getProvider } from '../utils/aiService';
import { AiOperationType, useAiContext } from './useAiContext';

export interface AiStatusInfo {
  hasKey: boolean;
  provider: string;
  isActive: boolean;
  currentOperation: AiOperationType | null;
  operationCount: number;
  lastOperation: {
    type: AiOperationType;
    timestamp: number;
    success: boolean;
  } | null;
}

export const useAiStatus = () => {
  const aiContext = useAiContext();
  const [operationCount, setOperationCount] = useState(0);
  const [lastOperation, setLastOperation] = useState<AiStatusInfo['lastOperation']>(null);

  // Track operation history
  useEffect(() => {
    if (aiContext.status === 'success' && aiContext.currentOperation) {
      setOperationCount(prev => prev + 1);
      setLastOperation({
        type: aiContext.currentOperation,
        timestamp: Date.now(),
        success: true
      });
    }
  }, [aiContext.status, aiContext.currentOperation]);

  const hasKey = !!getApiKey();
  const provider = getProvider();

  return {
    hasKey,
    provider,
    isActive: aiContext.isLoading,
    currentOperation: aiContext.currentOperation,
    operationCount,
    lastOperation,
    error: aiContext.error,
    configureApiKey: aiContext.configureApiKey,
    clearError: aiContext.clearError
  };
};
