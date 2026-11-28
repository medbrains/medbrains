package com.medbrains.kit

import java.text.Normalizer

/** One page of a server list, and how many rows the server counted in all. */
data class ListPage<T>(val rows: List<T>, val total: Int)

/**
 * The rows gathered across pages and the server's total, so a screen can say
 * "Showing N of M" instead of stopping silently at the first page.
 */
data class PagedRows<T>(val rows: List<T>, val total: Int) {
    /** False when the page cap stopped the walk before every row was read. */
    val isComplete: Boolean get() = rows.size >= total
}

/**
 * Reads pages 1, 2, … until the server's total is reached, a page comes back empty, or
 * [maxPages] have been read. The cap bounds the walk on a huge list; [PagedRows.isComplete]
 * tells the screen it was hit. A failed page fails the whole list. A row whose [key] was seen
 * on an earlier page is dropped: an admission between two reads shifts the offset and repeats
 * a row, and a lazy list keyed by id crashes on a repeat.
 */
suspend fun <T> fetchAllPages(maxPages: Int, key: (T) -> Any, fetch: suspend (page: Int) -> ListPage<T>): PagedRows<T> {
    val rows = mutableListOf<T>()
    val seen = HashSet<Any>()
    var total = 0
    for (page in 1..maxOf(maxPages, 1)) {
        val next = fetch(page)
        rows += next.rows.filter { seen.add(key(it)) }
        total = next.total
        if (next.rows.isEmpty() || rows.size >= total) break
    }
    return PagedRows(rows, maxOf(total, rows.size))
}

/**
 * True when every word of [query] appears in one of [fields], ignoring case and accents;
 * a blank query matches everything. For narrowing a loaded worklist.
 */
fun matchesSearch(query: String, fields: List<String?>): Boolean {
    val haystack = fold(fields.filterNotNull().joinToString(" "))
    return query.split(Regex("\\s+")).filter { it.isNotEmpty() }.all { fold(it) in haystack }
}

/** Lower-cased with accents removed, so "Renée" matches "renee". */
private fun fold(text: String): String =
    Normalizer.normalize(text, Normalizer.Form.NFD).replace(Regex("\\p{M}+"), "").lowercase()
