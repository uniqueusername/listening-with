package com.listeningwith.host.service

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import java.nio.charset.Charset

class NfcApduProcessorTest {

    private lateinit var processor: NfcApduProcessor

    @Before
    fun setup() {
        processor = NfcApduProcessor()
        NfcDataHolder.currentUrl = null // Reset before each test
    }

    @Test
    fun `test select aid returns success`() {
        // SELECT AID command for NDEF (D2 76 00 00 85 01 01)
        val command = byteArrayOf(
            0x00.toByte(), 0xA4.toByte(), 0x04.toByte(), 0x00.toByte(),
            0x07.toByte(), 0xD2.toByte(), 0x76.toByte(), 0x00.toByte(),
            0x00.toByte(), 0x85.toByte(), 0x01.toByte(), 0x01.toByte(),
            0x00.toByte()
        )

        val response = processor.processCommandApdu(command)
        
        // Expect 90 00 (Success)
        assertArrayEquals(byteArrayOf(0x90.toByte(), 0x00.toByte()), response)
    }

    @Test
    fun `test select cc file returns success`() {
        // Must select AID first
        selectAid()

        // SELECT CC File (E1 03)
        // 00 A4 00 0C 02 E1 03
        val command = byteArrayOf(
            0x00, 0xA4.toByte(), 0x00, 0x0C, 0x02, 0xE1.toByte(), 0x03
        )

        val response = processor.processCommandApdu(command)

        // Expect 90 00
        assertArrayEquals(byteArrayOf(0x90.toByte(), 0x00.toByte()), response)
    }

    @Test
    fun `test read cc file returns correct data`() {
        selectAid()
        
        // Select CC
        val selectCc = byteArrayOf(
            0x00, 0xA4.toByte(), 0x00, 0x0C, 0x02, 0xE1.toByte(), 0x03
        )
        processor.processCommandApdu(selectCc)

        // READ BINARY (Offset 0, Length 15)
        // 00 B0 00 00 0F
        val command = byteArrayOf(
            0x00, 0xB0.toByte(), 0x00, 0x00, 0x0F
        )

        val response = processor.processCommandApdu(command)

        // Expected CC File content (15 bytes) + 90 00
        val expectedCc = byteArrayOf(
            0x00, 0x0F, // CCLEN
            0x20, // Version 2.0
            0x00, 0xFF.toByte(), // MLe
            0x00, 0xFF.toByte(), // MLc
            0x04, // T
            0x06, // L
            0xE1.toByte(), 0x04.toByte(), // File ID (E1 04 - NDEF)
            0x04, 0x00, // Max size
            0x00, // Read
            0x00, // Write
            0x90.toByte(), 0x00.toByte() // Success
        )

        assertArrayEquals(expectedCc, response)
    }

    @Test
    fun `test select ndef file returns success`() {
        selectAid()

        // SELECT NDEF File (E1 04)
        // 00 A4 00 0C 02 E1 04
        val command = byteArrayOf(
            0x00, 0xA4.toByte(), 0x00, 0x0C, 0x02, 0xE1.toByte(), 0x04
        )

        val response = processor.processCommandApdu(command)

        // Expect 90 00
        assertArrayEquals(byteArrayOf(0x90.toByte(), 0x00.toByte()), response)
    }

    @Test
    fun `test read ndef file returns correct url`() {
        val testUrl = "https://listening-with.example.com/join/ABCD"
        NfcDataHolder.currentUrl = testUrl
        
        selectAid()

        // Select NDEF
        val selectNdef = byteArrayOf(
            0x00, 0xA4.toByte(), 0x00, 0x0C, 0x02, 0xE1.toByte(), 0x04
        )
        processor.processCommandApdu(selectNdef)

        // READ BINARY (Offset 0, Length 255)
        // 00 B0 00 00 FF
        val command = byteArrayOf(
            0x00, 0xB0.toByte(), 0x00, 0x00, 0xFF.toByte()
        )

        val response = processor.processCommandApdu(command)

        // Verify structure
        // Last 2 bytes should be 90 00
        assertEquals(0x90.toByte(), response[response.size - 2])
        assertEquals(0x00.toByte(), response[response.size - 1])

        // First 2 bytes are NLEN (big endian)
        val nlen = ((response[0].toInt() and 0xFF) shl 8) or (response[1].toInt() and 0xFF)
        
        // Payload is response size - 2 (NLEN) - 2 (Status Word)
        // Wait, logic in code:
        // fullNdefFile = [NLEN (2)] + [NDEF Message]
        // readData returns chunk + [90 00]
        
        val messageLength = response.size - 4 // -2 for NLEN, -2 for SW
        assertEquals(nlen, messageLength)
        
        // Verify NDEF Record
        // D1 (MB, ME, SR, TNF=Well Known)
        assertEquals(0xD1.toByte(), response[2])
        
        // Type Length (1)
        assertEquals(0x01.toByte(), response[3])
        
        // Payload Length
        val payloadLen = response[4].toInt()
        
        // Type 'U' (0x55)
        assertEquals(0x55.toByte(), response[5])
        
        // Identifier Code (0x04 for https://)
        assertEquals(0x04.toByte(), response[6])
        
        // The URL part (without https://)
        val expectedShortUrl = "listening-with.example.com/join/ABCD"
        val actualShortUrlBytes = ByteArray(expectedShortUrl.length)
        System.arraycopy(response, 7, actualShortUrlBytes, 0, actualShortUrlBytes.size)
        val actualShortUrl = String(actualShortUrlBytes, Charset.forName("UTF-8"))
        
        assertEquals(expectedShortUrl, actualShortUrl)
    }

    private fun selectAid() {
        val command = byteArrayOf(
            0x00.toByte(), 0xA4.toByte(), 0x04.toByte(), 0x00.toByte(),
            0x07.toByte(), 0xD2.toByte(), 0x76.toByte(), 0x00.toByte(),
            0x00.toByte(), 0x85.toByte(), 0x01.toByte(), 0x01.toByte(),
            0x00.toByte()
        )
        processor.processCommandApdu(command)
    }
}
