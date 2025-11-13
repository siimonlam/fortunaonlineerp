/// <reference types="vite/client" />

interface Window {
  gapi: any;
  google: {
    accounts: {
      oauth2: {
        initTokenClient: (config: any) => any;
      };
    };
  };
}
