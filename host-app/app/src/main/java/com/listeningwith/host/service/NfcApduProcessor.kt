package com.listeningwith.host.service

import java.nio.charset.Charset
import java.util.Arrays

class NfcApduProcessor {

    // AID for NDEF Application
    private val APDU_SELECT_AID = byteArrayOf(
        0x00.toByte(), 0xA4.toByte(), 0x04.toByte(), 0x00.toByte(),
        0x07.toByte(), 0xD2.toByte(), 0x76.toByte(), 0x00.toByte(),
        0x00.toByte(), 0x85.toByte(), 0x01.toByte(), 0x01.toByte(),
        0x00.toByte()
    )

    // Capability Container (CC) file
    private val CC_FILE = byteArrayOf(
        0x00, 0x0F, // CCLEN
        0x20, // Mapping Version 2.0
        0x00, 0xFF.toByte(), // MLe (255 bytes)
        0x00, 0xFF.toByte(), // MLc (255 bytes)
        0x04, // T (NDEF File Control TLV)
        0x06, // L
        0xE1.toByte(), 0x04.toByte(), // File Identifier
        0x04, 0x00, // Max NDEF size (1024 bytes)
        0x00, // Read Access
        0x00  // Write Access
    )

    // Selected file indicators
    private val NONE = 0
    private val CC = 1
    private val NDEF = 2

    private var selectedFile = NONE

    fun processCommandApdu(commandApdu: ByteArray): ByteArray {
        // SELECT AID
        if (Arrays.equals(APDU_SELECT_AID, commandApdu)) {
            selectedFile = NONE
            return byteArrayOf(0x90.toByte(), 0x00.toByte())
        }

        // SELECT File command
        if (commandApdu[0] == 0x00.toByte() && commandApdu[1] == 0xA4.toByte()) {
            // Check if selecting CC (E103) or NDEF (E104)
            if (commandApdu.size >= 7) { // 00 A4 00 0C 02 E1 03
                 if (commandApdu[5] == 0xE1.toByte() && commandApdu[6] == 0x03.toByte()) {
                     selectedFile = CC
                     return byteArrayOf(0x90.toByte(), 0x00.toByte())
                 } else if (commandApdu[5] == 0xE1.toByte() && commandApdu[6] == 0x04.toByte()) {
                     selectedFile = NDEF
                     return byteArrayOf(0x90.toByte(), 0x00.toByte())
                 }
            }
        }

        // READ BINARY command
        if (commandApdu[0] == 0x00.toByte() && commandApdu[1] == 0xB0.toByte()) {
            val offset = (commandApdu[2].toInt() and 0xFF) * 256 + (commandApdu[3].toInt() and 0xFF)
            val le = commandApdu[4].toInt() and 0xFF // Expected length

            if (selectedFile == CC) {
                return readData(CC_FILE, offset, le)
            } else if (selectedFile == NDEF) {
                val ndefMessage = createNdefMessage(NfcDataHolder.currentUrl)
                // Prepend NLEN (2 bytes, big endian)
                val fullNdefFile = ByteArray(ndefMessage.size + 2)
                fullNdefFile[0] = ((ndefMessage.size shr 8) and 0xFF).toByte()
                fullNdefFile[1] = (ndefMessage.size and 0xFF).toByte()
                System.arraycopy(ndefMessage, 0, fullNdefFile, 2, ndefMessage.size)
                
                return readData(fullNdefFile, offset, le)
            }
        }

        return byteArrayOf(0x6A.toByte(), 0x82.toByte()) // File not found / Error
    }

    private fun readData(data: ByteArray, offset: Int, length: Int): ByteArray {
        if (offset >= data.size) {
            return byteArrayOf(0x6A.toByte(), 0x82.toByte())
        }
        val len = Math.min(length, data.size - offset)
        val response = ByteArray(len + 2)
        System.arraycopy(data, offset, response, 0, len)
        response[len] = 0x90.toByte()
        response[len + 1] = 0x00.toByte()
        return response
    }

    private fun createNdefMessage(url: String?): ByteArray {
        if (url == null) return ByteArray(0)

        val urlBytes: ByteArray
        val identifierCode: Byte

        if (url.startsWith("https://www.")) {
             identifierCode = 0x02
             urlBytes = url.substring(12).toByteArray(Charset.forName("UTF-8"))
        } else if (url.startsWith("https://")) {
             identifierCode = 0x04
             urlBytes = url.substring(8).toByteArray(Charset.forName("UTF-8"))
        } else if (url.startsWith("http://")) {
             identifierCode = 0x03
             urlBytes = url.substring(7).toByteArray(Charset.forName("UTF-8"))
        } else {
             identifierCode = 0x00
             urlBytes = url.toByteArray(Charset.forName("UTF-8"))
        }

        val payloadLength = 1 + urlBytes.size
        
        // NDEF Record:
        // MB=1, ME=1, SR=1, TNF=01 (Well Known) -> 0xD1 (if payload < 255 bytes)
        // Assuming payloadLength < 255.
        
        val record = ByteArray(4 + payloadLength)
        record[0] = 0xD1.toByte() 
        record[1] = 0x01.toByte() // Type Length
        record[2] = payloadLength.toByte() // Payload Length
        record[3] = 0x55.toByte() // Type 'U'
        record[4] = identifierCode
        System.arraycopy(urlBytes, 0, record, 5, urlBytes.size)
        
        return record
    }

    fun reset() {
        selectedFile = NONE
    }
}
