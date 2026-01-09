export const environment = {
  production: true,
  premiumApiUrl: 'https://creativewriter-api.nostramo.workers.dev/api',
  stripe: {
    publishableKey: 'pk_live_51SZn3QFMve58hrbpGVD80Rv6CjUUgABJyPwSIOWuTnjTtUDzkjDtdMcZMzgX6qNFMjhc6vO2t4Fq4513tDCc7CgY00rVwd6HxD',
    pricingTableId: 'prctbl_1Saus0FMve58hrbpgBJ9yRlx'
  },
  // CouchDB URL - null means use auto-detection based on current hostname
  couchDbBaseUrl: null as string | null
};
