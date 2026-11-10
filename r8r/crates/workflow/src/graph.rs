//! Reachability and execution ordering over the workflow DAG.
//! Mirrors `packages/workflow/src/graph`.

use crate::errors::{Result, WorkflowError};
use crate::workflow::Workflow;
use std::collections::{HashSet, VecDeque};

/// Every node reachable from `start_ids` by following connections forward.
pub fn reachable_from(wf: &Workflow, start_ids: &[String]) -> HashSet<String> {
    let mut seen = HashSet::new();
    let mut queue: VecDeque<String> = start_ids.iter().cloned().collect();
    while let Some(id) = queue.pop_front() {
        if !seen.insert(id.clone()) {
            continue;
        }
        for c in wf.connections_from(&id) {
            queue.push_back(c.to.clone());
        }
    }
    seen
}

/// Execution order for the sub-graph reachable from `start_ids` (Kahn's
/// algorithm). Ready nodes are seeded in declaration order so that a given
/// workflow always executes in the same sequence.
pub fn execution_order(wf: &Workflow, start_ids: &[String]) -> Result<Vec<String>> {
    let reachable = reachable_from(wf, start_ids);

    // Only reachable nodes get an entry, so a successful `get` doubles as the
    // reachability check and no index can panic.
    let mut indeg: std::collections::HashMap<String, usize> =
        reachable.iter().map(|id| (id.clone(), 0)).collect();
    for c in &wf.connections {
        if let Some(count) = indeg.get_mut(&c.to).filter(|_| reachable.contains(&c.from)) {
            *count += 1;
        }
    }

    let mut ready: VecDeque<String> = wf
        .nodes
        .iter()
        .filter(|n| indeg.get(&n.id).is_some_and(|d| *d == 0))
        .map(|n| n.id.clone())
        .collect();

    let mut order = Vec::with_capacity(reachable.len());
    while let Some(id) = ready.pop_front() {
        order.push(id.clone());
        for c in wf.connections_from(&id) {
            if let Some(d) = indeg.get_mut(&c.to) {
                *d -= 1;
                if *d == 0 {
                    ready.push_back(c.to.clone());
                }
            }
        }
    }

    if order.len() != reachable.len() {
        return Err(WorkflowError::Cycle);
    }
    Ok(order)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::interfaces::{Connection, Node};
    use serde_json::json;

    fn node(id: &str, kind: &str) -> Node {
        serde_json::from_value(json!({ "id": id, "type": kind, "name": id })).unwrap()
    }
    fn edge(from: &str, to: &str) -> Connection {
        Connection {
            from: from.into(),
            to: to.into(),
            port: "main".into(),
        }
    }

    fn diamond() -> Workflow {
        Workflow {
            nodes: vec![
                node("a", "manual"),
                node("b", "noOp"),
                node("c", "noOp"),
                node("d", "noOp"),
            ],
            connections: vec![
                edge("a", "b"),
                edge("a", "c"),
                edge("b", "d"),
                edge("c", "d"),
            ],
            ..Default::default()
        }
    }

    #[test]
    fn orders_a_diamond_with_the_join_last() {
        let order = execution_order(&diamond(), &["a".into()]).unwrap();
        assert_eq!(order.first().unwrap(), "a");
        assert_eq!(
            order.last().unwrap(),
            "d",
            "join node must run after both branches"
        );
        assert_eq!(order.len(), 4);
    }

    #[test]
    fn ignores_nodes_not_reachable_from_the_start() {
        let mut wf = diamond();
        wf.nodes.push(node("orphan", "noOp"));
        let order = execution_order(&wf, &["a".into()]).unwrap();
        assert!(!order.contains(&"orphan".to_string()));
    }

    #[test]
    fn rejects_cycles() {
        let mut wf = diamond();
        wf.connections.push(edge("d", "b"));
        assert!(matches!(
            execution_order(&wf, &["a".into()]),
            Err(WorkflowError::Cycle)
        ));
    }
}
