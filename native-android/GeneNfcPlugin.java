package com.genesaret.pos.training;

import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Locale;

@CapacitorPlugin(name="GeneNfc")
public class GeneNfcPlugin extends Plugin {
    private final Handler main = new Handler(Looper.getMainLooper());
    private PluginCall pending;
    private NfcAdapter adapter;
    private final Runnable timeout = () -> finish(null,"Tiempo de lectura agotado. Intenta otra vez.");
    @PluginMethod public void read(PluginCall call) {
        main.post(() -> {
            if(pending != null) finish(null,"Lectura cancelada");
            adapter = NfcAdapter.getDefaultAdapter(getActivity());
            if(adapter == null || !adapter.isEnabled()) {call.reject("Activa NFC en los ajustes de Android o usa QR.");return;}
            pending = call;
            try {
                adapter.enableReaderMode(getActivity(),tag -> main.post(() -> {
                    if(pending != call)return;
                    byte[] id=tag.getId();
                    if(id==null || id.length==0){finish(null,"Chip sin identificador");return;}
                    StringBuilder hex=new StringBuilder();
                    for(byte b:id)hex.append(String.format(Locale.ROOT,"%02X",b & 255));
                    finish(hex.toString(),null);
                }),NfcAdapter.FLAG_READER_NFC_A | NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK | NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS,null);
                main.postDelayed(timeout,20000);
            }catch(Exception e){finish(null,"No se pudo iniciar NFC");}
        });
    }
    @PluginMethod public void cancel(PluginCall call){main.post(()->{finish(null,"Lectura cancelada");call.resolve();});}
    private void finish(String id,String error){
        PluginCall call=pending; if(call==null)return;
        pending=null;main.removeCallbacks(timeout);
        try{if(adapter!=null)adapter.disableReaderMode(getActivity());}catch(Exception ignored){}
        if(error!=null)call.reject(error);else{JSObject result=new JSObject();result.put("uid",id);call.resolve(result);}
    }
    @Override protected void handleOnPause(){main.post(()->finish(null,"Lectura cancelada"));super.handleOnPause();}
}
