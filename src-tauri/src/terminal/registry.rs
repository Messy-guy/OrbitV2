use std::collections::HashMap;
use std::sync::Arc;

use parking_lot::RwLock;

use super::session::TerminalSession;

#[derive(Clone, Default)]
pub struct TerminalRegistry {
    sessions: Arc<RwLock<HashMap<String, Arc<TerminalSession>>>>,
}

impl TerminalRegistry {
    pub fn insert(&self, session: Arc<TerminalSession>) {
        self.sessions
            .write()
            .insert(session.info.session_id.clone(), session);
    }

    pub fn get(&self, session_id: &str) -> Option<Arc<TerminalSession>> {
        self.sessions.read().get(session_id).cloned()
    }

    pub fn find_by_agent(&self, agent_id: &str) -> Option<Arc<TerminalSession>> {
        self.sessions
            .read()
            .values()
            .find(|session| session.info.agent_id == agent_id)
            .cloned()
    }

    pub fn remove(&self, session_id: &str) -> Option<Arc<TerminalSession>> {
        self.sessions.write().remove(session_id)
    }

    pub fn stop_and_remove(&self, session_id: &str) -> Result<(), String> {
        if let Some(session) = self.remove(session_id) {
            session.stop()?;
        }
        Ok(())
    }

    pub fn stop_by_provider(&self, provider: &str) -> Result<(), String> {
        let session_ids = self
            .sessions
            .read()
            .values()
            .filter(|session| session.info.provider.eq_ignore_ascii_case(provider))
            .map(|session| session.info.session_id.clone())
            .collect::<Vec<_>>();
        for session_id in session_ids {
            self.stop_and_remove(&session_id)?;
        }
        Ok(())
    }

    pub fn stop_by_agent_except(
        &self,
        agent_id: &str,
        keep_session_id: &str,
    ) -> Result<(), String> {
        let session_ids = self
            .sessions
            .read()
            .values()
            .filter(|session| {
                session.info.agent_id == agent_id && session.info.session_id != keep_session_id
            })
            .map(|session| session.info.session_id.clone())
            .collect::<Vec<_>>();
        for session_id in session_ids {
            self.stop_and_remove(&session_id)?;
        }
        Ok(())
    }
}
