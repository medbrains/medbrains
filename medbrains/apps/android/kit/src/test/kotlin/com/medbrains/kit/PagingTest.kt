package com.medbrains.kit

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

/** A worklist reads every page the server has, says when it stopped short, and narrows by any word. */
class PagingTest {
    /** A server holding [total] numbered rows, served [perPage] at a time. */
    private fun server(total: Int, perPage: Int): suspend (Int) -> ListPage<Int> = { page ->
        val start = (page - 1) * perPage
        ListPage((start until minOf(start + perPage, total)).toList(), total)
    }

    @Test
    fun everyPageIsReadUntilTheTotal() = runBlocking {
        val paged = fetchAllPages(10, { it }, server(250, 100))
        assertEquals(250, paged.rows.size)
        assertEquals(250, paged.total)
        assertTrue(paged.isComplete)
    }

    @Test
    fun thePageCapStopsTheWalkAndSaysSo() = runBlocking {
        val paged = fetchAllPages(2, { it }, server(250, 100))
        assertEquals(200, paged.rows.size)
        assertEquals(250, paged.total)
        assertFalse(paged.isComplete)
    }

    @Test
    fun anEmptyPageEndsTheWalkEvenIfTheTotalPromisedMore() = runBlocking {
        var calls = 0
        val paged = fetchAllPages(10, { it }) { page ->
            calls++
            ListPage(
                if (page ==
                    1
                ) {
                    listOf(1, 2)
                } else {
                    emptyList()
                },
                5
            )
        }
        assertEquals(2, calls)
        assertEquals(listOf(1, 2), paged.rows)
    }

    @Test
    fun aRowRepeatedOnTheNextPageIsKeptOnce() = runBlocking {
        // Someone admitted between the two reads pushes row 1 onto page 2 as well.
        val paged = fetchAllPages(10, { it }) { page -> ListPage(if (page == 1) listOf(0, 1) else listOf(1, 2), 3) }
        assertEquals(listOf(0, 1, 2), paged.rows)
    }

    @Test
    fun aFailedPageFailsTheWholeListRatherThanShowingPart() = runBlocking {
        try {
            fetchAllPages(10, { it }) { page ->
                if (page ==
                    2
                ) {
                    error("down")
                } else {
                    ListPage((0 until 100).toList(), 150)
                }
            }
            fail("a failed page must not pass as a shorter list")
        } catch (_: IllegalStateException) {
        }
    }

    @Test
    fun searchMatchesEveryWordAcrossFieldsIgnoringCaseAndAccents() {
        val fields = listOf("Renée Kumar", "MB-000123", "IP-000045", "B-12")
        assertTrue(matchesSearch("", fields))
        assertTrue(matchesSearch("renee b-12", fields))
        assertTrue(matchesSearch("ip-000045", fields))
        assertFalse(matchesSearch("renee b-13", fields))
        assertTrue(matchesSearch("kumar", listOf(null, "Renée Kumar")))
    }
}
