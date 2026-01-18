package com.listeningwith.host.service

import android.nfc.cardemulation.HostApduService
import android.os.Bundle
import android.util.Log
import java.nio.charset.Charset
import java.util.Arrays

object NfcDataHolder {
    var currentUrl: String? = null
}

class NfcHostService : HostApduService() {

    private val TAG = "NfcHostService"
    private val processor = NfcApduProcessor()

    override fun processCommandApdu(commandApdu: ByteArray, extras: Bundle?): ByteArray {
        return processor.processCommandApdu(commandApdu)
    }

    override fun onDeactivated(reason: Int) {
        processor.reset()
    }
}
