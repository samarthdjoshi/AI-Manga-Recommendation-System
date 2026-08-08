"""
Simple union-find (disjoint-set) with path compression.

Used to merge records across sources: whenever two nodes are known
to refer to the same manga (via an exact ID match), union() links
them. Transitive merges are handled automatically - if A merges with
B, and B separately merges with C, find() correctly reports A, B,
and C as one group even though A and C were never directly linked.
"""

from __future__ import annotations


class UnionFind:
    def __init__(self) -> None:
        self.parent: dict[tuple[str, str], tuple[str, str]] = {}

    def add(self, node: tuple[str, str]) -> None:
        if node not in self.parent:
            self.parent[node] = node

    def find(self, node: tuple[str, str]) -> tuple[str, str]:
        self.add(node)
        root = node
        while self.parent[root] != root:
            root = self.parent[root]

        while self.parent[node] != root:
            self.parent[node], node = root, self.parent[node]

        return root

    def union(self, a: tuple[str, str], b: tuple[str, str]) -> None:
        root_a = self.find(a)
        root_b = self.find(b)
        if root_a != root_b:
            self.parent[root_b] = root_a

    def groups(self) -> dict[tuple[str, str], list[tuple[str, str]]]:
        result: dict[tuple[str, str], list[tuple[str, str]]] = {}
        for node in self.parent:
            root = self.find(node)
            result.setdefault(root, []).append(node)
        return result
