import { ReactNode } from 'react';
import { Api, ApiConfig } from './api';
export declare function ApiProvider({ config, api, children, }: {
    config?: ApiConfig;
    /** Supply a client directly. Used by tests. */
    api?: Api;
    children: ReactNode;
}): import("react").JSX.Element;
export declare function useApi(): Api;
