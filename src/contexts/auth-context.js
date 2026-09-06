import { createContext } from 'react';

// Contexto isolado num arquivo próprio (sem componentes) para não disparar
// o lint react-refresh/only-export-components no AuthContext.jsx.
export const AuthContext = createContext(undefined);
