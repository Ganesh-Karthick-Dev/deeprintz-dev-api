const { Session } = require('@shopify/shopify-api');

// Hybrid session storage that works with Express sessions and Shopify OAuth
class HybridSessionStorage {
  constructor() {
    this.sessions = new Map();
    this.oauthStates = new Map();
    this.expressSessionStore = null;
  }

  // Set the Express session store reference
  setExpressSessionStore(store) {
    this.expressSessionStore = store;
  }

  // Generate OAuth session ID from request
  generateOAuthSessionId(shop, isOnline = false) {
    const timestamp = Date.now();
    const suffix = isOnline ? 'online' : 'offline';
    return `oauth_${shop}_${suffix}_${timestamp}`;
  }

  // Store OAuth state for later verification
  storeOAuthState(state, shop) {
    this.oauthStates.set(state, {
      shop: shop,
      timestamp: Date.now(),
      sessionId: this.generateOAuthSessionId(shop, false)
    });
    console.log(`🔐 OAuth state stored: ${state} for shop: ${shop}`);
  }

  // Retrieve OAuth state
  getOAuthState(state) {
    const stateData = this.oauthStates.get(state);
    if (stateData) {
      // Clean up old state
      this.oauthStates.delete(state);
      console.log(`🔐 OAuth state retrieved: ${state} for shop: ${stateData.shop}`);
      return stateData;
    }
    console.log(`❌ OAuth state not found: ${state}`);
    return null;
  }

  async storeSession(session) {
    try {
      const sessionData = session.toObject ? session.toObject() : session;
      const sessionId = sessionData.id || session.id;
      
      console.log(`📝 Storing Shopify session:`, {
        id: sessionId,
        shop: sessionData.shop,
        isOnline: sessionData.isOnline,
        hasToken: !!sessionData.accessToken,
        scope: sessionData.scope
      });

      this.sessions.set(sessionId, sessionData);
      
      // Also store by shop for easy lookup
      if (sessionData.shop) {
        const shopKey = `shop_${sessionData.shop}_${sessionData.isOnline ? 'online' : 'offline'}`;
        this.sessions.set(shopKey, sessionData);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error storing Shopify session:', error);
      return false;
    }
  }

  async loadSession(id) {
    try {
      console.log(`🔍 Loading Shopify session: ${id}`);
      
      let sessionData = this.sessions.get(id);
      
      if (!sessionData && id.includes('.myshopify.com')) {
        // Try both online and offline keys
        const offlineKey = `shop_${id}_offline`;
        const onlineKey = `shop_${id}_online`;
        
        sessionData = this.sessions.get(offlineKey) || this.sessions.get(onlineKey);
        
        if (sessionData) {
          console.log(`✅ Session found by shop key: ${id}`);
        }
      }
      
      if (sessionData) {
        console.log(`✅ Session loaded: ${id} for shop: ${sessionData.shop}`);
        return new Session(sessionData);
      }
      
      console.log(`❌ Session not found: ${id}`);
      console.log(`📋 Available sessions:`, Array.from(this.sessions.keys()));
      return undefined;
    } catch (error) {
      console.error('❌ Error loading Shopify session:', error);
      return undefined;
    }
  }

  async deleteSession(id) {
    try {
      const sessionData = this.sessions.get(id);
      let deleted = this.sessions.delete(id);
      
      // Also delete shop key if exists
      if (sessionData && sessionData.shop) {
        const shopKey = `shop_${sessionData.shop}_${sessionData.isOnline ? 'online' : 'offline'}`;
        this.sessions.delete(shopKey);
      }
      
      console.log(`🗑️ Session deleted: ${id} (success: ${deleted})`);
      return deleted;
    } catch (error) {
      console.error('❌ Error deleting session:', error);
      return false;
    }
  }

  async deleteSessions(ids) {
    let count = 0;
    for (const id of ids) {
      if (await this.deleteSession(id)) count++;
    }
    console.log(`🗑️ Sessions deleted: ${count}/${ids.length}`);
    return true;
  }

  async findSessionsByShop(shop) {
    try {
      const sessions = [];
      for (const [id, sessionData] of this.sessions.entries()) {
        if (sessionData.shop === shop) {
          sessions.push(new Session(sessionData));
        }
      }
      console.log(`🔍 Found ${sessions.length} sessions for shop: ${shop}`);
      return sessions;
    } catch (error) {
      console.error('❌ Error finding sessions by shop:', error);
      return [];
    }
  }

  // Debug method
  getAllSessions() {
    console.log('📋 All Shopify sessions:', Array.from(this.sessions.keys()));
    console.log('📋 All OAuth states:', Array.from(this.oauthStates.keys()));
    return {
      sessions: this.sessions,
      oauthStates: this.oauthStates
    };
  }

  // Clear expired OAuth states (older than 10 minutes)
  clearExpiredStates() {
    const now = Date.now();
    const expireTime = 10 * 60 * 1000; // 10 minutes
    
    for (const [state, data] of this.oauthStates.entries()) {
      if (now - data.timestamp > expireTime) {
        this.oauthStates.delete(state);
        console.log(`🧹 Expired OAuth state cleaned: ${state}`);
      }
    }
  }
}

module.exports = { HybridSessionStorage };